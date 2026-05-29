const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const { authenticate } = require("../middleware/auth");

const PROJECTS_ROOT = () => path.resolve(process.env.PROJECTS_ROOT || "./data/projects");

function projectDir(id) {
  return path.join(PROJECTS_ROOT(), String(id));
}

function safePath(projectId, filePath) {
  const base = projectDir(projectId);
  const resolved = path.resolve(base, filePath);
  if (!resolved.startsWith(base)) throw new Error("Path traversal not allowed");
  return resolved;
}

router.use(authenticate);

router.get("/:id/files", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const dir = projectDir(req.params.id);
    if (!fs.existsSync(dir)) return res.json({ files: [] });

    function listFiles(dirPath, relBase = "") {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const result = [];
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          result.push({ name: entry.name, path: rel, type: "dir", children: listFiles(path.join(dirPath, entry.name), rel) });
        } else {
          const stat = fs.statSync(path.join(dirPath, entry.name));
          result.push({ name: entry.name, path: rel, type: "file", size: stat.size });
        }
      }
      return result;
    }

    res.json({ files: listFiles(dir) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/files/read", async (req, res) => {
  const { filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: "filePath required" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const full = safePath(req.params.id, filePath);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "File not found" });
    const content = fs.readFileSync(full, "utf-8");
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/files/write", async (req, res) => {
  const { filePath, content = "" } = req.body;
  if (!filePath) return res.status(400).json({ error: "filePath required" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const full = safePath(req.params.id, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf-8");
    res.json({ message: "File saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/files/mkdir", async (req, res) => {
  const { dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: "dirPath required" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const full = safePath(req.params.id, dirPath);
    fs.mkdirSync(full, { recursive: true });
    res.json({ message: "Directory created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id/files", async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: "filePath required" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const full = safePath(req.params.id, filePath);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "File not found" });
    fs.rmSync(full, { recursive: true, force: true });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/files/rename", async (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: "oldPath and newPath required" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const oldFull = safePath(req.params.id, oldPath);
    const newFull = safePath(req.params.id, newPath);
    fs.mkdirSync(path.dirname(newFull), { recursive: true });
    fs.renameSync(oldFull, newFull);
    res.json({ message: "Renamed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
