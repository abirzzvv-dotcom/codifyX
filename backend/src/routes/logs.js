const router = require("express").Router();
const { pool } = require("../db");
const { authenticate } = require("../middleware/auth");
const { pm2Logs } = require("../services/pm2");

router.use(authenticate);

router.get("/", async (req, res) => {
  const { project_id, level, limit = 100, offset = 0 } = req.query;
  try {
    let query = `
      SELECT l.id, l.project_id, l.message, l.level, l.created_at, p.name as project_name
      FROM logs l
      LEFT JOIN projects p ON p.id = l.project_id
      WHERE l.user_id = $1
    `;
    const params = [req.user.id];
    if (project_id) { params.push(project_id); query += ` AND l.project_id = $${params.length}`; }
    if (level) { params.push(level); query += ` AND l.level = $${params.length}`; }
    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await pool.query(query, params);
    res.json({ logs: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

router.get("/projects/:id/live", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const lines = parseInt(req.query.lines) || 50;
    const output = await pm2Logs(req.params.id, lines);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    await pool.query("DELETE FROM logs WHERE project_id=$1", [req.params.id]);
    res.json({ message: "Logs cleared" });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

module.exports = router;
