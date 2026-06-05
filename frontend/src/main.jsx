import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("rag_chat_messages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }); // { role: "user" | "assistant", content: string, citations?: any[] }
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    refreshHealth();
  }, []);

  useEffect(() => {
    localStorage.setItem("rag_chat_messages", JSON.stringify(messages));
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

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg = {
        id: assistantMsgId,
        role: "assistant",
        content: data.answer || fallbackAnswer,
        citations: data.citations || [],
        isEvaluating: true
      };

      setMessages((current) => [...current, assistantMsg]);
      
      const contextTexts = data.citations ? data.citations.map(c => c.text) : [];
      runAutoEvaluation(assistantMsgId, cleanQuestion, data.answer, contextTexts);
    } catch (queryError) {
      setError(readError(queryError));
      // Remove the optimistic user message if it failed
      setMessages((current) => current.filter(m => m.id !== userMsg.id));
    } finally {
      setIsAsking(false);
    }
  }

  async function runAutoEvaluation(messageId, questionText, answer, contexts) {
    try {
      const { data } = await api.post("/evaluate-single", { 
        question: questionText,
        answer: answer,
        contexts: contexts
      });
      
      setMessages((prev) => 
        prev.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              isEvaluating: false,
              evaluationData: data.results?.questions?.[0] || null
            };
          }
          return msg;
        })
      );
    } catch (error) {
      console.error("Auto-evaluation failed:", error);
      setMessages((prev) => 
        prev.map((msg) => msg.id === messageId ? { ...msg, isEvaluating: false } : msg)
      );
    }
  }

  async function handleEvaluateBatch() {
    setError("");
    // We instantly show the dashboard using the local chat messages data!
    setIsEvalModalOpen(true);
  }

  async function handleReset() {
    setError("");
    try {
      await api.delete("/reset");
      setActiveDocuments([]);
      setActiveFile(null);
      setMessages([]);
      localStorage.removeItem("rag_chat_messages");
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

          {/* Restore Evaluation Panel for Dashboard */}
          <div className="evaluation-panel" style={{ marginTop: "2rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
            <div className="panel-heading">
              <h2>RAG Evaluation</h2>
            </div>
            
            <button 
              className="primary-button outline" 
              onClick={handleEvaluateBatch} 
              disabled={activeDocuments.length === 0}
              style={{ width: "100%", marginBottom: "1rem" }}
            >
              Open Evaluation Dashboard
            </button>
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

                  {message.role === "assistant" && (
                    <div className="evaluation-wrapper" style={{ marginTop: '1rem' }}>
                      {message.isEvaluating && (
                        <div className="inline-eval-loading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          <div className="pulse-dot" style={{ width: '8px', height: '8px', background: 'var(--primary-color)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
                          <span>Auto-evaluating AI response... (approx. 1 min)</span>
                        </div>
                      )}
                      {message.evaluationData && (
                        <div className="inline-eval-results" style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          <div className="inline-eval-badge" style={{ background: 'rgba(255,255,255,0.8)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Accuracy</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{Math.round(message.evaluationData.faithfulness * 100)}%</span>
                          </div>
                          <div className="inline-eval-badge" style={{ background: 'rgba(255,255,255,0.8)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Relevancy</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{Math.round(message.evaluationData.answer_relevancy * 100)}%</span>
                          </div>
                          <div className="inline-eval-badge" style={{ background: 'rgba(255,255,255,0.8)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Precision</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{Math.round(message.evaluationData.context_precision * 100)}%</span>
                          </div>
                          <div className="inline-eval-badge" style={{ background: 'rgba(255,255,255,0.8)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Recall</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{Math.round(message.evaluationData.context_recall * 100)}%</span>
                          </div>
                        </div>
                      )}
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

      <BarGraphDashboard 
        isOpen={isEvalModalOpen} 
        onClose={() => setIsEvalModalOpen(false)} 
        messages={messages} 
      />
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

function BarGraphDashboard({ isOpen, onClose, messages }) {
  if (!isOpen) return null;

  // Compute chart data directly from chat messages
  const chartData = messages
    .filter((m) => m.role === "assistant" && m.evaluationData)
    .map((q, index) => {
      const msgIndex = messages.findIndex((m) => m.id === q.id);
      const questionText = messages[msgIndex - 1]?.content || "Unknown Question";
      
      return {
        name: `Q${index + 1}`,
        fullQuestion: questionText,
        Faithfulness: Math.round(q.evaluationData.faithfulness * 100),
        Relevancy: Math.round(q.evaluationData.answer_relevancy * 100),
        Precision: Math.round(q.evaluationData.context_precision * 100),
        Recall: Math.round(q.evaluationData.context_recall * 100),
      };
    });

  const averages = chartData.length > 0 ? {
    faithfulness: chartData.reduce((acc, curr) => acc + curr.Faithfulness, 0) / chartData.length / 100,
    answer_relevancy: chartData.reduce((acc, curr) => acc + curr.Relevancy, 0) / chartData.length / 100,
    context_precision: chartData.reduce((acc, curr) => acc + curr.Precision, 0) / chartData.length / 100,
    context_recall: chartData.reduce((acc, curr) => acc + curr.Recall, 0) / chartData.length / 100,
  } : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ragas Performance Dashboard</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          {chartData.length > 0 && averages ? (
            <div className="bargraph-container">
              <h3 className="section-title">Overall Averages</h3>
              <div className="bar-wrapper">
                <div className="bar-label">
                  <span>Accuracy (No Hallucinations)</span>
                  <span>{Math.round(averages.faithfulness * 100)}%</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill accuracy" style={{ width: `${averages.faithfulness * 100}%` }}></div>
                </div>
              </div>
              
              <div className="bar-wrapper">
                <div className="bar-label">
                  <span>Answer Relevancy</span>
                  <span>{Math.round(averages.answer_relevancy * 100)}%</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill relevancy" style={{ width: `${averages.answer_relevancy * 100}%` }}></div>
                </div>
              </div>
              
              <div className="bar-wrapper">
                <div className="bar-label">
                  <span>Context Precision</span>
                  <span>{Math.round(averages.context_precision * 100)}%</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill precision" style={{ width: `${averages.context_precision * 100}%` }}></div>
                </div>
              </div>
              
              <div className="bar-wrapper">
                <div className="bar-label">
                  <span>Context Recall</span>
                  <span>{Math.round(averages.context_recall * 100)}%</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill recall" style={{ width: `${averages.context_recall * 100}%` }}></div>
                </div>
              </div>

              {chartData.length > 0 && (
                <div className="question-breakdown" style={{ marginTop: '2.5rem', height: '400px' }}>
                  <h3 className="section-title">Evaluation Report (Per Question)</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(tick) => `${tick}%`} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="custom-tooltip" style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', maxWidth: '300px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                <p style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.9rem', color: '#0f172a' }}>{payload[0].payload.fullQuestion}</p>
                                {payload.map(p => (
                                  <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                    <span style={{ color: p.color, fontWeight: '500' }}>{p.name}:</span>
                                    <span style={{ fontWeight: 'bold', color: '#0f172a', marginLeft: '12px' }}>{p.value}%</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '0.85rem' }} />
                      <Bar dataKey="Faithfulness" name="Faithfulness" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Relevancy" name="Answer Relevance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Precision" name="Context Precision" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Recall" name="Context Recall" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>No evaluation data available. Run the evaluation to see metrics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
