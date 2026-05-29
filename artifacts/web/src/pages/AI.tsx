import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { Sidebar } from "./Dashboard";

interface Project { id: number; name: string; }
interface Message { role: "user" | "assistant"; content: string; isAction?: boolean; }

export default function AI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [includeFiles, setIncludeFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ projects: Project[] }>("/projects").then((d) => setProjects(d.projects || [])).catch(() => {});
    loadHistory();
  }, []);
  useEffect(() => { loadHistory(); }, [selectedProject]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadHistory() {
    try { const qs = selectedProject ? `?project_id=${selectedProject}` : ""; const d = await api.get<{ history: Message[] }>(`/ai/history${qs}`); setMessages(d.history || []); } catch {}
  }
  async function clearHistory() {
    if (!confirm("Clear AI chat history?")) return;
    try { const qs = selectedProject ? `?project_id=${selectedProject}` : ""; await api.delete(`/ai/history${qs}`); setMessages([]); } catch {}
  }
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault(); const msg = input.trim(); if (!msg || loading) return;
    setInput(""); setMessages((prev) => [...prev, { role: "user", content: msg }]); setLoading(true);
    try {
      const data = await api.post<{ reply: string; actions: { action: string; path: string }[] }>("/ai/chat", { message: msg, project_id: selectedProject || undefined, include_files: includeFiles });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.actions?.length > 0) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Applied: ${data.actions.map((a) => `${a.action}: ${a.path}`).join(", ")}`, isAction: true }]);
      }
    } catch (err: unknown) { setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Failed"}` }]); }
    finally { setLoading(false); }
  }

  function formatContent(content: string) {
    return content.split(/(```[\s\S]*?```)/g).map((part, i) => {
      if (part.startsWith("```")) { const code = part.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""); return <pre key={i}>{code}</pre>; }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1>AI Assistant</h1><p>Powered by NVIDIA Gemma 3n — debug, edit, and create code</p></div>
          <button className="btn-ghost btn-sm" onClick={clearHistory}>Clear History</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={{ width: "auto", minWidth: 200 }}>
            <option value="">No project context</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProject && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} style={{ width: "auto" }} />
              Include project files
            </label>
          )}
        </div>
        <div className="chat-wrap">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{ color: "var(--muted)", textAlign: "center", marginTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                <div>Ask me to debug, write, or explain code.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Select a project above for context.</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`} style={m.isAction ? { background: "rgba(99,102,241,0.1)", color: "var(--accent)", fontSize: 12 } : {}}>
                {formatContent(m.content)}
              </div>
            ))}
            {loading && <div className="chat-msg assistant" style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="spinner" /> Thinking...</div>}
            <div ref={bottomRef} />
          </div>
          <form className="chat-input-row" onSubmit={sendMessage}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything... 'Fix the error', 'Add a /ping command', 'Explain this code'" disabled={loading} />
            <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
