import cors from "cors";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { wrapOpenAI } from "langsmith/wrappers";
import { traceable } from "langsmith/traceable";
import { config, validateConfig } from "./config.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 50
  }
});

const llm = wrapOpenAI(new OpenAI({
  apiKey: config.llm.apiKey || "missing-key",
  baseURL: config.llm.baseURL
}));

let activeDocuments = [];

app.use(cors({ origin: config.frontendOrigin, credentials: false }));
app.use(express.json({ limit: "50mb" })); // Increased limit for bulk queries if needed

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Legal RAG Assistant",
    activeDocuments,
    keyFingerprint: {
      pinecone: fingerprint(config.pinecone.apiKey),
      groq: fingerprint(config.llm.apiKey)
    },
    missingConfig: validateConfig()
  });
});

app.post("/api/upload", upload.array("files", 50), async (req, res, next) => {
  try {
    requireReadyConfig();

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please choose at least one PDF, DOCX, or TXT file." });
    }

    const indexHost = await getIndexHost();
    const uploadedDocs = [];

    // Process files sequentially to avoid rate limits on embeddings
    for (const file of req.files) {
      const text = await extractText(file);
      if (!text.trim()) {
        console.warn(`No readable text found in ${file.originalname}`);
        continue;
      }

      const chunks = await chunkText(text);
      if (!chunks.length) {
        console.warn(`No searchable chunks produced for ${file.originalname}`);
        continue;
      }

      const documentId = createDocumentId();
      const vectors = await embedChunks(chunks, documentId, file.originalname);
      await upsertInBatches(indexHost, vectors);

      const doc = {
        id: documentId,
        filename: file.originalname,
        chunks: chunks.length,
        uploadedAt: new Date().toISOString()
      };
      
      activeDocuments = activeDocuments.filter(d => d.filename !== doc.filename);
      activeDocuments.push(doc);
      uploadedDocs.push(doc);
    }

    if (uploadedDocs.length === 0) {
      return res.status(400).json({ error: "None of the uploaded documents produced searchable text." });
    }

    res.json({
      message: `${uploadedDocs.length} documents uploaded and indexed.`,
      documents: uploadedDocs,
      activeDocuments
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/query", async (req, res, next) => {
  try {
    requireReadyConfig();

    const { question, filename, conversationHistory = [] } = req.body;
    const cleanQuestion = String(question || "").trim();
    if (!cleanQuestion) {
      return res.status(400).json({ error: "Ask a question about the uploaded legal documents." });
    }
    if (activeDocuments.length === 0) {
      return res.status(400).json({ error: "Upload legal documents before asking questions." });
    }

    const indexHost = await getIndexHost();
    
    // 1. Rewrite Query
    const historyText = conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join("\n");
    const rewrittenQuery = await rewriteQuery(cleanQuestion, historyText);
    console.log("Original Query:", cleanQuestion);
    console.log("Rewritten Query:", rewrittenQuery);

    // 2. Retrieve Relevant Chunks
    const queryEmbedding = await embedQuery(rewrittenQuery);
    
    // Optional filtering by filename
    const filter = filename ? { filename: { $eq: filename } } : undefined;

    const retrieval = await pineconeDataRequest(indexHost, "/query", {
      vector: queryEmbedding,
      topK: 15, // Retrieve more for reranking
      namespace: config.pinecone.namespace,
      includeMetadata: true,
      filter
    });

    let citations = (retrieval.matches || [])
      .filter((match) => Number(match.score || 0) > 0.1) // Lower threshold to allow reranker to work
      .map((match, idx) => ({
        id: match.id,
        number: idx + 1,
        score: Number(match.score || 0),
        text: String(match.metadata?.text || ""),
        filename: String(match.metadata?.filename || ""),
        chunkIndex: Number(match.metadata?.chunkIndex ?? idx)
      }));

    console.log("Pinecone matches retrieved:", retrieval.matches?.length || 0);
    console.log("Citations after score filter:", citations.length);

    if (!citations.length) {
      return res.json({
        answer: "Answer not found in the uploaded documents.",
        citations: []
      });
    }

    // 4. Rerank retrieved chunks
    citations = await rerankChunks(cleanQuestion, citations);
    console.log("Citations after rerank:", citations.length);

    if (!citations.length) {
      return res.json({
        answer: "Answer not found in the uploaded documents.",
        citations: []
      });
    }

    // 5 & 6. Answer with context
    const answer = await answerWithContext(cleanQuestion, citations);
    console.log("Generated answer:", answer.substring(0, 50) + "...");
    res.json({ answer, citations });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/reset", async (_req, res, next) => {
  try {
    requireReadyConfig();

    const indexHost = await getIndexHost();
    await deleteNamespace(indexHost).catch(() => undefined);
    activeDocuments = [];
    res.json({ message: "Document vectors deleted." });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || error.statusCode || 500;
  const message = friendlyError(error);
  res.status(status).json({ error: message });
});

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Legal RAG Assistant API running on http://localhost:${config.port}`);
  });
}

export default app;

// Helpers

const rewriteQuery = traceable(async function rewriteQuery(originalQuery, historyText) {
  const completion = await llm.chat.completions.create({
    model: config.llm.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "You are a legal query optimization assistant for retrieval systems."
      },
      {
        role: "user",
        content: `Rewrite the user query into a retrieval-optimized search query for legal document retrieval. Preserve the user's original intent. DO NOT hallucinate, guess, or add specific document names, countries, or laws that are not explicitly mentioned in the original query or history. If the query is just a short phrase (like "section 20"), leave it as is or lightly rephrase it without adding fabricated context.\n\nOriginal Query:\n${originalQuery}\n\nConversation History:\n${historyText}\n\nPlease provide only the rewritten query.`
      }
    ]
  });
  return completion.choices?.[0]?.message?.content?.trim() || originalQuery;
}, { name: "rewriteQuery" });

const rerankChunks = traceable(async function rerankChunks(question, citations) {
  const contextText = citations.map(c => `[Chunk ${c.number}]\n${c.text}`).join("\n\n");
  
  const completion = await llm.chat.completions.create({
    model: config.llm.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "You are a legal relevance ranking assistant. Given a question and a list of legal document chunks, identify which chunks are useful to answer the question. Return ONLY a comma-separated list of the Chunk numbers that are relevant, ordered by relevance. If none are relevant, return 'None'."
      },
      {
        role: "user",
        content: `Question: ${question}\n\nChunks:\n${contextText}`
      }
    ]
  });

  const response = completion.choices?.[0]?.message?.content?.trim() || "";
  if (response === "None" || !response) return [];
  
  const relevantNumbers = response.split(",").map(s => parseInt(s.trim().replace(/[^\d]/g, ''))).filter(n => !isNaN(n));
  
  const reranked = [];
  const citationMap = new Map(citations.map(c => [c.number, c]));
  
  for (const num of relevantNumbers) {
    if (citationMap.has(num)) {
      reranked.push(citationMap.get(num));
      citationMap.delete(num);
    }
  }
  
  if (reranked.length === 0) return citations.slice(0, 5);
  
  return reranked.slice(0, 5);
}, { name: "rerankChunks" });

function requireReadyConfig() {
  const missing = validateConfig();
  if (missing.length) {
    const error = new Error(`Missing backend configuration: ${missing.join(", ")}`);
    error.status = 500;
    throw error;
  }
}

async function getIndexHost() {
  const existingIndexes = await pineconeControlRequest("/indexes");
  const indexes = existingIndexes.indexes || [];
  const exists = indexes.some((idx) => idx.name === config.pinecone.indexName);

  if (!exists) {
    await pineconeControlRequest("/indexes", {
      name: config.pinecone.indexName,
      vector_type: "dense",
      dimension: config.pinecone.embeddingDimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: config.pinecone.cloud,
          region: config.pinecone.region
        }
      }
    });
  }

  return waitForIndexReady();
}

async function waitForIndexReady() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const details = await pineconeControlRequest(`/indexes/${config.pinecone.indexName}`);
    if (details.status?.ready) return details.host;
    await sleep(2500);
  }

  throw new Error("Timed out waiting for the Pinecone index to become ready.");
}

async function extractText(file) {
  const extension = file.originalname.split(".").pop()?.toLowerCase();
  const mime = file.mimetype;

  if (extension === "pdf" || mime === "application/pdf") {
    const parsed = await pdfParse(file.buffer);
    return parsed.text || "";
  }

  if (
    extension === "docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || "";
  }

  if (extension === "txt" || mime.startsWith("text/")) {
    return file.buffer.toString("utf8");
  }

  const error = new Error("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
  error.status = 400;
  throw error;
}

async function chunkText(text) {
  const normalized = normalizeText(text);
  const chunks = [];
  const chunkSize = 1100;
  const overlap = 180;
  let cursor = 0;

  while (cursor < normalized.length) {
    const targetEnd = Math.min(cursor + chunkSize, normalized.length);
    let end = targetEnd;

    if (targetEnd < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", targetEnd);
      const sentenceBreak = normalized.lastIndexOf(". ", targetEnd);
      const lineBreak = normalized.lastIndexOf("\n", targetEnd);
      const spaceBreak = normalized.lastIndexOf(" ", targetEnd);
      const bestBreak = [paragraphBreak, sentenceBreak, lineBreak, spaceBreak]
        .filter((position) => position > cursor + chunkSize * 0.55)
        .sort((a, b) => b - a)[0];

      if (bestBreak) end = bestBreak + 1;
    }

    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

async function embedChunks(chunks, documentId, filename) {
  const vectors = [];

  for (let i = 0; i < chunks.length; i += 48) {
    const batch = chunks.slice(i, i + 48);
    const embeddings = await embedWithPinecone(
      batch.map((chunk) => ({ text: `passage: ${chunk}` })),
      "passage"
    );

    embeddings.data.forEach((embedding, batchIndex) => {
      const chunkIndex = i + batchIndex;
      vectors.push({
        id: `${documentId}-${chunkIndex}`,
        values: embedding.values,
        metadata: {
          documentId,
          filename,
          chunkIndex,
          text: batch[batchIndex]
        }
      });
    });
  }

  return vectors;
}

async function embedQuery(question) {
  const embeddings = await embedWithPinecone([{ text: `query: ${question}` }], "query");

  return embeddings.data[0].values;
}

async function upsertInBatches(indexHost, vectors) {
  for (let i = 0; i < vectors.length; i += 100) {
    await pineconeDataRequest(indexHost, "/vectors/upsert", {
      vectors: vectors.slice(i, i + 100),
      namespace: config.pinecone.namespace
    });
  }
}

async function embedWithPinecone(inputs, inputType) {
  return pineconeInferenceRequest("/embed", {
    model: config.pinecone.embeddingModel,
    inputs,
    parameters: {
      input_type: inputType,
      truncate: "END"
    }
  });
}

async function deleteNamespace(indexHost) {
  return pineconeDataRequest(indexHost, "/vectors/delete", {
    deleteAll: true,
    namespace: config.pinecone.namespace
  });
}

const answerWithContext = traceable(async function answerWithContext(question, citations) {
  const context = citations
    .map((citation) => `[${citation.number}] ${citation.text}`)
    .join("\n\n");

  const completion = await llm.chat.completions.create({
    model: config.llm.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "You are a domain-specific Multi-Document Legal RAG Assistant. Answer ONLY using the provided context from the uploaded legal documents. If the answer is not present in the context, reply exactly: \"Answer not found in the uploaded documents.\""
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion:\n${question}\n\nAnswer:`
      }
    ]
  });

  const answer = completion.choices?.[0]?.message?.content?.trim() || "";
  if (!answer || answer === "Answer not found in the uploaded documents.") {
    return "Answer not found in the uploaded documents.";
  }

  return answer;
}, { name: "answerWithContext" });

async function pineconeControlRequest(path, body, method = body ? "POST" : "GET") {
  return pineconeRequest(`https://api.pinecone.io${path}`, body, method, "2025-10");
}

async function pineconeDataRequest(host, path, body, method = body ? "POST" : "GET") {
  return pineconeRequest(`https://${host}${path}`, body, method, "2025-10");
}

async function pineconeInferenceRequest(path, body) {
  return pineconeRequest(`https://api.pinecone.io${path}`, body, "POST", "2025-10");
}

async function pineconeRequest(url, body, method, apiVersion) {
  const response = await fetch(url, {
    method,
    headers: {
      "Api-Key": config.pinecone.apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-Api-Version": apiVersion
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 404 && method === "DELETE") return {};

  const text = await response.text();
  const data = parseJsonResponse(text);

  if (!response.ok) {
    const rawMessage = data.message || data.error || `Pinecone request failed with ${response.status}.`;
    const message =
      typeof rawMessage === "string" && rawMessage.toLowerCase().includes("invalid api key")
        ? "Pinecone rejected PINECONE_API_KEY. Please paste a valid Pinecone API key in backend/.env and restart the backend."
        : rawMessage;
    const error = new Error(message);
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  return data;
}

function parseJsonResponse(text) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createDocumentId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function fingerprint(value) {
  if (!value) return null;
  return `${value.slice(0, 8)}...${value.slice(-4)} (${value.length})`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyError(error) {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return "File is too large. Upload a document under 15 MB.";
  }
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
    return "Too many files uploaded. Please upload a maximum of 50 files.";
  }

  if (error.message?.includes("Missing backend configuration")) {
    return error.message;
  }

  if (error.status && error.status < 500) {
    return error.message;
  }

  console.error(error);
  if (config.nodeEnv !== "production" && error.message) {
    return error.message;
  }

  return "Something went wrong while processing the request.";
}
