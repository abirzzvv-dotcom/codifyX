import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Sidebar } from "./Dashboard";

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", description: "", type: "nodejs", main_file: "index.js", port: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post("/projects", { ...form, port: form.port ? parseInt(form.port) : undefined });
      onCreate(data.project);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="fields">
            <div>
              <label>Project Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-bot" required />
            </div>
            <div>
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this project do?" />
            </div>
            <div>
              <label>Type</label>
              <select value={form.type} onChange={(e) => {
                const t = e.target.value;
                setForm({ ...form, type: t, main_file: t === "python" ? "main.py" : "index.js" });
              }}>
                <option value="nodejs">Node.js</option>
                <option value="python">Python</option>
                <option value="discord-bot">Discord Bot</option>
                <option value="api">API</option>
              </select>
            </div>
            <div>
              <label>Main File</label>
              <input value={form.main_file} onChange={(e) => setForm({ ...form, main_file: e.target.value })} placeholder="index.js" />
            </div>
            <div>
              <label>Port (optional)</label>
              <input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="3000" />
            </div>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <div className="actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstallModal({ project, onClose }) {
  const [packages, setPackages] = useState("");
  const [manager, setManager] = useState("npm");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInstall(e) {
    e.preventDefault();
    const pkgList = packages.split(/[\s,]+/).filter(Boolean);
    if (!pkgList.length) return;
    setLoading(true);
    setOutput("");
    try {
      const data = await api.post(`/projects/${project.id}/install`, { packages: pkgList, manager });
      setOutput(data.output + (data.errors || ""));
    } catch (err) {
      setOutput("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Install Packages — {project.name}</h2>
        <form onSubmit={handleInstall}>
          <div className="fields">
            <div>
              <label>Package Manager</label>
              <select value={manager} onChange={(e) => setManager(e.target.value)}>
                <option value="npm">npm</option>
                <option value="pip">pip</option>
              </select>
            </div>
            <div>
              <label>Packages (space or comma separated)</label>
              <input value={packages} onChange={(e) => setPackages(e.target.value)} placeholder="express dotenv" required />
            </div>
          </div>
          {output && <div className="log-output" style={{ marginTop: 14, maxHeight: 200 }}>{output}</div>}
          <div className="actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : "Install"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [installProject, setInstallProject] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await api.get("/projects");
      setProjects(data.projects || []);
    } catch {}
    setLoading(false);
  }

  async function handleAction(projectId, action) {
    setActionLoading((prev) => ({ ...prev, [`${projectId}-${action}`]: true }));
    try {
      await api.post(`/projects/${projectId}/${action}`);
      await loadProjects();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${projectId}-${action}`]: false }));
    }
  }

  async function handleDelete(project) {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${project.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Projects</h1>
            <p>Manage your hosted applications</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
        </div>

        {loading ? (
          <div style={{ color: "var(--muted)" }}>Loading...</div>
        ) : projects.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>&#9964;</div>
            <div>No projects yet. Create your first one.</div>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((p) => (
              <div key={p.id} className="project-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="project-name">{p.name}</div>
                    <div className="project-type">{p.type} · {p.main_file}</div>
                    {p.description && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{p.description}</div>}
                  </div>
                  <span className={`badge badge-${p.status === "running" ? "running" : "stopped"}`}>{p.status}</span>
                </div>
                <div className="project-actions">
                  {p.status !== "running" ? (
                    <button
                      className="btn-success btn-sm"
                      onClick={() => handleAction(p.id, "start")}
                      disabled={actionLoading[`${p.id}-start`]}
                    >
                      {actionLoading[`${p.id}-start`] ? <span className="spinner" /> : "Start"}
                    </button>
                  ) : (
                    <>
                      <button className="btn-ghost btn-sm" onClick={() => handleAction(p.id, "restart")} disabled={actionLoading[`${p.id}-restart`]}>
                        {actionLoading[`${p.id}-restart`] ? <span className="spinner" /> : "Restart"}
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => handleAction(p.id, "stop")} disabled={actionLoading[`${p.id}-stop`]}>
                        {actionLoading[`${p.id}-stop`] ? <span className="spinner" /> : "Stop"}
                      </button>
                    </>
                  )}
                  <Link to={`/projects/${p.id}/files`} className="btn-ghost btn-sm" style={{ padding: "5px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    Files
                  </Link>
                  <button className="btn-ghost btn-sm" onClick={() => setInstallProject(p)}>Packages</button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={(p) => setProjects((prev) => [p, ...prev])} />
      )}
      {installProject && (
        <InstallModal project={installProject} onClose={() => setInstallProject(null)} />
      )}
    </div>
  );
}
