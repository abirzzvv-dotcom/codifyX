const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { pm2Stop, pm2Delete } = require("../services/pm2");

const PROJECTS_ROOT = () => path.resolve(process.env.PROJECTS_ROOT || "./data/projects");

router.use(authenticate, requireAdmin);

router.get("/users", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, email, role, verified, suspended, created_at FROM users ORDER BY created_at DESC"
    );
    res.json({ users: rows });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/users/:id/suspend", async (req, res) => {
  const { suspended } = req.body;
  try {
    await pool.query("UPDATE users SET suspended=$1 WHERE id=$2", [!!suspended, req.params.id]);
    res.json({ message: suspended ? "User suspended" : "User unsuspended" });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  try {
    await pool.query("UPDATE users SET role=$1 WHERE id=$2", [role, req.params.id]);
    res.json({ message: `Role updated to ${role}` });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE user_id=$1",
      [req.params.id]
    );
    for (const project of rows) {
      await pm2Stop(project.id).catch(() => {});
      await pm2Delete(project.id).catch(() => {});
      const dir = path.join(PROJECTS_ROOT(), String(project.id));
      fs.rmSync(dir, { recursive: true, force: true });
    }
    await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
    res.json({ message: "User and all their projects deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.type, p.status, p.created_at, u.username, u.email
      FROM projects p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
    `);
    res.json({ projects: rows });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/projects/:id/stop", async (req, res) => {
  try {
    await pm2Stop(req.params.id);
    await pool.query("UPDATE projects SET status='stopped' WHERE id=$1", [req.params.id]);
    res.json({ message: "Project stopped" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    await pm2Stop(req.params.id).catch(() => {});
    await pm2Delete(req.params.id).catch(() => {});
    const dir = path.join(PROJECTS_ROOT(), String(req.params.id));
    fs.rmSync(dir, { recursive: true, force: true });
    await pool.query("DELETE FROM projects WHERE id=$1", [req.params.id]);
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [users, projects, logs] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*), status FROM projects GROUP BY status"),
      pool.query("SELECT COUNT(*) FROM logs WHERE created_at > NOW() - INTERVAL '24 hours'"),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      projectsByStatus: projects.rows,
      logsLast24h: parseInt(logs.rows[0].count),
    });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

module.exports = router;
