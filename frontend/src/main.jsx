import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./styles.css";

const defaultApiUrl = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:4005/api"
  : "/api";
const API_URL = import.meta.env?.VITE_API_URL || defaultApiUrl;
const api = axios.create({ baseURL: API_URL });
const fallbackAnswer = "Answer not found in the uploaded documents.";

function App() {
  const [health, setHealth] = useState(null);
  const [activeDocuments, setActiveDocuments] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // { role: "user" | "assistant", content: string, citations?: any[] }
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    refreshHealth();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canAsk = useMemo(
    () => Boolean(activeDocuments.length > 0 && question.trim() && !isAsking),
    [activeDocuments, question, isAsking]
  );

  async function refreshHealth() {
    try {
      const { data } = await api.get("/health");
      setHealth(data);
      setActiveDocuments(data.activeDocuments || []);
      if (!activeFile && data.activeDocuments?.length > 0) {
        setActiveFile("all");
      }
    } catch {
      setError("Backend is not reachable. Start the API server and try again.");
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setError("Choose at least one PDF, DOCX, or TXT file.");
      return;
    }
    if (selectedFiles.length > 50) {
      setError("You can only upload up to 50 documents at once.");
      return;
    }

    const oversized = selectedFiles.filter(f => f.size > 4 * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`Vercel limits requests to 4.5MB. Please compress files over 4MB: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    setError("");
    setIsUploading(true);
    setUploadProgress(0);

    try {
      let finalActiveDocs = activeDocuments;
      let anyUploaded = false;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append("files", file);

        const { data } = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        finalActiveDocs = data.activeDocuments;
        if (data.documents && data.documents.length > 0) {
          anyUploaded = true;
        }
        
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      setActiveDocuments(finalActiveDocs);
      if (anyUploaded) {
        setActiveFile("all");
      }
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (uploadError) {
      setError(readError(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAsk(event) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    // Add user message immediately
    const userMsg = { id: crypto.randomUUID(), role: "user", content: cleanQuestion };
    setMessages((current) => [...current, userMsg]);
    setQuestion("");
    setIsAsking(true);
    setError("");

    try {
      // Build conversation history excluding citations for the API
      const historyText = messages.map(m => ({ role: m.role, content: m.content }));
      
      const { data } = await api.post("/query", { 
        question: cleanQuestion,
        filename: activeFile === "all" ? undefined : activeFile,
        conversationHistory: historyText
      });

      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || fallbackAnswer,
        citations: data.citations || []
      };

      setMessages((current) => [...current, assistantMsg]);
    } catch (queryError) {
      setError(readError(queryError));
      // Remove the optimistic user message if it failed
      setMessages((current) => current.filter(m => m.id !== userMsg.id));
    } finally {
      setIsAsking(false);
    }
  }

  async function handleReset() {
    setError("");
    try {
      await api.delete("/reset");
      setActiveDocuments([]);
      setActiveFile(null);
      setMessages([]);
      setSelectedFiles([]);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshHealth();
    } catch (resetError) {
      setError(readError(resetError));
    }
  }

  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Legal Document Assistant</p>
          <h1>Legal RAG Assistant</h1>
        </div>
        <div className={health?.ok ? "status online" : "status offline"}>
          <span />
          {health?.ok ? "API online" : "API offline"}
        </div>
      </section>

      {error && <div className="notice">{error}</div>}

      <section className="workspace">
        <aside className="panel upload-panel">
          <div className="panel-heading">
            <h2>Legal Knowledge Base</h2>
            <button className="ghost-button" onClick={handleReset} disabled={activeDocuments.length === 0 && !messages.length}>
              Clear All
            </button>
          </div>

          <form onSubmit={handleUpload} className="upload-form">
            <label className="dropzone">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelection}
              />
              <span>
                {selectedFiles.length > 0 
                  ? `${selectedFiles.length} file(s) selected` 
                  : "Click to select up to 50 legal documents (PDF, DOCX, TXT)"}
              </span>
            </label>

            <button className="primary-button" type="submit" disabled={isUploading || selectedFiles.length === 0}>
              {isUploading ? "Processing Documents..." : "Upload Documents"}
            </button>
          </form>

          {uploadProgress > 0 && (
            <div className="progress-track" aria-label="Upload progress">
              <div style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          <div className="active-files">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Active Documents</h3>
            {activeDocuments.length > 0 ? (
              <div className="files-list">
                <div 
                  className={`file-item ${activeFile === "all" ? "active" : ""}`}
                  onClick={() => setActiveFile("all")}
                >
                  <strong>All Documents</strong>
                  <span>Search across all legal knowledge</span>
                </div>
                {activeDocuments.map(doc => (
                  <div 
                    key={doc.id}
                    className={`file-item ${activeFile === doc.filename ? "active" : ""}`}
                    onClick={() => setActiveFile(doc.filename)}
                  >
                    <strong>{doc.filename}</strong>
                    <span>{doc.chunks} chunks</span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No documents uploaded</span>
            )}
          </div>

          {health?.missingConfig?.length > 0 && (
            <div className="notice" style={{ marginTop: 'auto' }}>
              Missing backend env: {health.missingConfig.join(", ")}
            </div>
          )}
        </aside>

        <section className="panel ask-panel">
          <div className="chat-history">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div>
                  <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Welcome to Legal RAG</h3>
                  <p>Upload legal documents and ask questions. Answers are securely grounded in your case files.</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article className={`chat-message ${message.role}`} key={message.id}>
                  <div className="message-bubble">
                    {message.content}
                  </div>
                  {message.role === "assistant" && message.citations?.length > 0 && (
                    <div className="citations-wrapper">
                      <h3>Supporting Evidence</h3>
                      {message.citations.map((citation) => (
                        <details key={citation.id}>
                          <summary>
                            Chunk {citation.chunkIndex + 1} from {citation.filename} · Score: {citation.score.toFixed(2)}
                          </summary>
                          <p>{citation.text}</p>
                        </details>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
            {isAsking && (
              <article className="chat-message assistant">
                <div className="message-bubble" style={{ opacity: 0.7 }}>
                  <em>Analyzing legal text...</em>
                </div>
              </article>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="input-area">
            <form onSubmit={handleAsk} className="question-form">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={activeDocuments.length ? "Ask a legal question..." : "Upload documents first..."}
                disabled={activeDocuments.length === 0 || isAsking}
              />
              <button className="primary-button" type="submit" disabled={!canAsk}>
                Send
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}

function readError(error) {
  let message = error.response?.data?.error || error.message || "Something went wrong.";
  // Ensure we always return a string, not an object
  if (typeof message === 'object') {
    message = message?.message || JSON.stringify(message);
  }
  return String(message);
}

createRoot(document.getElementById("root")).render(<App />);
