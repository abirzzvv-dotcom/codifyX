import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { api } from "../api";

interface Project { id: number; name: string; type: string; status: string; }
interface Log { id: number; message: string; level: string; created_at: string; project_name?: string; }

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="sidebar">
      <div className="logo">TermuxHost</div>
      <nav>
        <Link to="/" className={pathname === "/" ? "active" : ""}>Dashboard</Link>
        <Link to="/projects" className={pathname.startsWith("/projects") ? "active" : ""}>Projects</Link>
        <Link to="/logs" className={pathname === "/logs" ? "active" : ""}>Logs</Link>
        <Link to="/ai" className={pathname === "/ai" ? "active" : ""}>AI Assistant</Link>
      </nav>
      <div className="user-info">
        <div className="username">{user?.username}</div>
        <div className="email">{user?.email}</div>
        <button className="btn-ghost btn-sm logout-btn" onClick={() => { logout(); navigate("/login"); }}>Sign out</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [ngrok, setNgrok] = useState<{ url: string | null; connected: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pData, lData] = await Promise.all([
          api.get<{ projects: Project[] }>("/projects"),
          api.get<{ logs: Log[] }>("/logs?limit=5"),
        ]);
        setProjects((pData as { projects: Project[] }).projects || []);
        setLogs((lData as { logs: Log[] }).logs || []);
        try { setNgrok(await api.get("/ngrok/status") as { url: string | null; connected: boolean }); } catch {}
      } catch {}
      setLoading(false);
    })();
  }, []);

  const running = projects.filter((p) => p.status === "running").length;

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.username}</p>
        </div>
        {loading ? <div style={{ color: "var(--muted)" }}>Loading...</div> : (
          <>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-value">{projects.length}</div><div className="stat-label">Total Projects</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--success)" }}>{running}</div><div className="stat-label">Running</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--muted)" }}>{projects.length - running}</div><div className="stat-label">Stopped</div></div>
            </div>
            {ngrok && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Ngrok</span>
                  <span className={`badge ${ngrok.connected ? "badge-running" : "badge-stopped"}`}>{ngrok.connected ? "Connected" : "Disconnected"}</span>
                </div>
                {ngrok.url && <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{ngrok.url}</div>}
              </div>
            )}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Recent Projects</span><Link to="/projects" style={{ fontSize: 12 }}>View all</Link>
              </div>
              {projects.length === 0 ? (
                <div className="card" style={{ color: "var(--muted)", textAlign: "center", padding: 32 }}>No projects yet. <Link to="/projects">Create your first project</Link></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {projects.slice(0, 4).map((p) => (
                    <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                      <div><div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div><div style={{ color: "var(--muted)", fontSize: 11 }}>{p.type}</div></div>
                      <span className={`badge badge-${p.status === "running" ? "running" : "stopped"}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Recent Activity</span><Link to="/logs" style={{ fontSize: 12 }}>View all</Link>
              </div>
              {logs.length === 0 ? (
                <div className="card" style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>No activity yet</div>
              ) : (
                <div className="log-output" style={{ maxHeight: 200 }}>
                  {logs.map((l) => (
                    <div key={l.id} className={`log-${l.level}`}>
                      [{new Date(l.created_at).toLocaleTimeString()}] {l.project_name ? `[${l.project_name}] ` : ""}{l.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
