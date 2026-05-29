import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Sidebar } from "./Dashboard";

function FileTree({ files, selected, onSelect, depth = 0 }) {
  return (
    <div style={{ paddingLeft: depth * 12 }}>
      {files.map((f) => (
        <div key={f.path}>
          {f.type === "dir" ? (
            <div>
              <div className="file-tree-item file-tree-dir">
                <span>&#128193;</span> {f.name}
              </div>
              {f.children && <FileTree files={f.children} selected={selected} onSelect={onSelect} depth={depth + 1} />}
            </div>
          ) : (
            <div
              className={`file-tree-item ${selected === f.path ? "selected" : ""}`}
              onClick={() => onSelect(f.path)}
            >
              <span>&#128196;</span> {f.name}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Files() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [newFile, setNewFile] = useState("");

  useEffect(() => {
    loadProject();
    loadFiles();
  }, [id]);

  async function loadProject() {
    try {
      const data = await api.get(`/projects/${id}`);
      setProject(data.project);
    } catch {}
  }

  async function loadFiles() {
    try {
      const data = await api.get(`/projects/${id}/files`);
      setFiles(data.files || []);
    } catch {}
  }

  async function openFile(path) {
    setSelected(path);
    setLoading(true);
    setMsg("");
    try {
      const data = await api.get(`/projects/${id}/files/read?filePath=${encodeURIComponent(path)}`);
      setContent(data.content || "");
    } catch (err) {
      setContent("");
      setMsg("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveFile() {
    if (!selected) return;
    setSaving(true);
    setMsg("");
    try {
      await api.post(`/projects/${id}/files/write`, { filePath: selected, content });
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 2000);
    } catch (err) {
      setMsg("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile() {
    if (!selected) return;
    if (!confirm(`Delete "${selected}"?`)) return;
    try {
      await api.delete(`/projects/${id}/files`, { filePath: selected });
      setSelected(null);
      setContent("");
      await loadFiles();
    } catch (err) {
      setMsg("Error: " + err.message);
    }
  }

  async function createFile(e) {
    e.preventDefault();
    if (!newFile.trim()) return;
    try {
      await api.post(`/projects/${id}/files/write`, { filePath: newFile.trim(), content: "" });
      await loadFiles();
      await openFile(newFile.trim());
      setNewFile("");
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
            <h1>Files — {project?.name || "..."}</h1>
            <p>
              <Link to="/projects" style={{ color: "var(--muted)", fontSize: 12 }}>← Back to Projects</Link>
            </p>
          </div>
          <form onSubmit={createFile} style={{ display: "flex", gap: 8 }}>
            <input
              value={newFile}
              onChange={(e) => setNewFile(e.target.value)}
              placeholder="new-file.js"
              style={{ width: 160 }}
            />
            <button type="submit" className="btn-ghost btn-sm" style={{ padding: "8px 14px" }}>+ New File</button>
          </form>
        </div>

        <div className="editor-layout">
          <div className="file-tree">
            {files.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 12, padding: 8 }}>No files</div>
            ) : (
              <FileTree files={files} selected={selected} onSelect={openFile} />
            )}
          </div>

          <div className="editor-area">
            {selected ? (
              <>
                <div className="editor-toolbar">
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", flex: 1 }}>{selected}</span>
                  {msg && <span className={msg.startsWith("Error") ? "error-msg" : "success-msg"}>{msg}</span>}
                  <button className="btn-danger btn-sm" onClick={deleteFile}>Delete</button>
                  <button className="btn-primary btn-sm" onClick={saveFile} disabled={saving}>
                    {saving ? <span className="spinner" /> : "Save"}
                  </button>
                </div>
                <textarea
                  value={loading ? "Loading..." : content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={loading}
                  spellCheck={false}
                  style={{ flex: 1, minHeight: 0 }}
                />
              </>
            ) : (
              <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                Select a file to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
