import dotenv from "dotenv";

dotenv.config();

if (process.env.LANGSMITH_TRACING) process.env.LANGCHAIN_TRACING_V2 = process.env.LANGSMITH_TRACING;
if (process.env.LANGSMITH_ENDPOINT) process.env.LANGCHAIN_ENDPOINT = process.env.LANGSMITH_ENDPOINT;
if (process.env.LANGSMITH_API_KEY) process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY;
if (process.env.LANGSMITH_PROJECT) process.env.LANGCHAIN_PROJECT = process.env.LANGSMITH_PROJECT.trim().replace(/^["']|["']$/g, "");

function env(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.trim().replace(/^["']|["']$/g, "");
}

export const config = {
  port: Number(env("PORT", "4000")),
  nodeEnv: env("NODE_ENV", "development"),
  frontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:5173"),
  pinecone: {
    apiKey: env("PINECONE_API_KEY"),
    indexName: env("PINECONE_INDEX_NAME", "naive-rag"),
    namespace: env("PINECONE_NAMESPACE", "default"),
    cloud: env("PINECONE_CLOUD", "aws"),
    region: env("PINECONE_REGION", "us-east-1"),
    embeddingModel: "multilingual-e5-large",
    embeddingDimension: 1024
  },
  llm: {
    provider: env("LLM_PROVIDER", "groq"),
    apiKey: env("GROQ_API_KEY"),
    model: env("GROQ_MODEL", "llama-3.3-70b-versatile"),
    baseURL: env("GROQ_API_URL", "https://api.groq.com/openai/v1")
  }
};

export function validateConfig() {
  const missing = [];

  if (!config.pinecone.apiKey) missing.push("PINECONE_API_KEY");
  if (!config.llm.apiKey) missing.push("GROQ_API_KEY");
  if (config.llm.provider !== "groq") missing.push("LLM_PROVIDER=groq");

  return missing;
}
