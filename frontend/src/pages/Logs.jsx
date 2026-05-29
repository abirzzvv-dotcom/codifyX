import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { Sidebar } from "./Dashboard";

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [liveOutput, setLiveOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadProjects();
    loadLogs();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [selectedProject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, liveOutput]);

  async function loadProjects() {
    try {
      const data = await api.get("/projects");
      setProjects(data.projects || []);
    } catch {}
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const qs = selectedProject ? `?project_id=${selectedProject}&limit=200` : "?limit=200";
      const data = await api.get(`/logs${qs}`);
      setLogs(data.logs || []);
    } catch {}
    setLoading(false);
  }

  async function loadLiveLogs() {
    if (!selectedProject) return;
    setLiveLoading(true);
    try {
      const data = await api.get(`/logs/projects/${selectedProject}/live?lines=100`);
      setLiveOutput(data.output || "No output");
    } catch (err) {
      setLiveOutput("Error: " + err.message);
    } finally {
      setLiveLoading(false);
    }
  }

  async function clearLogs() {
    if (!selectedProject) return;
    if (!confirm("Clear logs for this project?")) return;
    try {
      await api.delete(`/logs/projects/${selectedProject}`);
      setLogs([]);
      setLiveOutput("");
    } catch {}
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>Logs</h1>
          <p>View activity and PM2 output for your projects</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <select
            value={selectedProject}
            onChange={(e) => { setSelectedProject(e.target.value); setLiveOutput(""); }}
            style={{ width: "auto", minWidth: 200 }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn-ghost" onClick={loadLogs}>Refresh</button>
          {selectedProject && (
            <>
              <button className="btn-ghost" onClick={loadLiveLogs} disabled={liveLoading}>
                {liveLoading ? <span className="spinner" /> : "PM2 Live Logs"}
              </button>
              <button className="btn-danger btn-sm" onClick={clearLogs} style={{ padding: "8px 14px" }}>Clear</button>
            </>
          )}
        </div>

        {liveOutput && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--muted)", fontSize: 12 }}>PM2 OUTPUT</div>
            <div className="log-output">{liveOutput}</div>
          </div>
        )}

        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--muted)", fontSize: 12 }}>ACTIVITY LOG</div>
          {loading ? (
            <div style={{ color: "var(--muted)" }}>Loading...</div>
          ) : logs.length === 0 ? (
            <div className="card" style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>No logs found</div>
          ) : (
            <div className="log-output">
              {logs.map((l) => (
                <div key={l.id} className={`log-${l.level || "info"}`}>
                  {new Date(l.created_at).toLocaleString()} {l.project_name ? `[${l.project_name}]` : ""} {l.message}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
