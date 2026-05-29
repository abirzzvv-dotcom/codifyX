const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const { authenticate } = require("../middleware/auth");
const pm2 = require("../services/pm2");

const PROJECTS_ROOT = () => path.resolve(process.env.PROJECTS_ROOT || "./data/projects");

function projectDir(id) {
  return path.join(PROJECTS_ROOT(), String(id));
}

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, description, type, status, port, main_file, created_at, updated_at FROM projects WHERE user_id=$1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ projects: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/", async (req, res) => {
  const { name, description, type = "nodejs", main_file = "index.js", port } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO projects (user_id, name, description, type, main_file, port) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [req.user.id, name, description, type, main_file, port || null]
    );
    const project = rows[0];
    const dir = projectDir(project.id);
    fs.mkdirSync(dir, { recursive: true });

    if (type === "nodejs") {
      fs.writeFileSync(path.join(dir, "index.js"), `// ${name}\nconsole.log("${name} running");\n`);
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", main: "index.js" }, null, 2));
    } else if (type === "python") {
      fs.writeFileSync(path.join(dir, "main.py"), `# ${name}\nprint("${name} running")\n`);
    } else {
      fs.writeFileSync(path.join(dir, project.main_file || "index.js"), `// ${name}\n`);
    }

    await pool.query("INSERT INTO logs (project_id, user_id, message, level) VALUES ($1,$2,$3,'info')", [
      project.id, req.user.id, `Project "${name}" created`
    ]);

    res.status(201).json({ project });
  } catch (err) {
    console.error("[Projects/create]", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ project: rows[0] });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/:id", async (req, res) => {
  const { name, description, main_file, port } = req.body;
  try {
    const { rows } = await pool.query(
      "UPDATE projects SET name=COALESCE($1,name), description=COALESCE($2,description), main_file=COALESCE($3,main_file), port=COALESCE($4,port), updated_at=NOW() WHERE id=$5 AND user_id=$6 RETURNING *",
      [name, description, main_file, port, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ project: rows[0] });
  } catch {
    res.status(500).json({ error: "Failed to update" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    await pm2.pm2Delete(req.params.id).catch(() => {});
    const dir = projectDir(req.params.id);
    fs.rmSync(dir, { recursive: true, force: true });

    await pool.query("DELETE FROM projects WHERE id=$1", [req.params.id]);
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

router.post("/:id/start", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const project = rows[0];

    const result = await pm2.pm2Start(project);
    await pool.query("UPDATE projects SET status='running', updated_at=NOW() WHERE id=$1", [project.id]);
    await pool.query("INSERT INTO logs (project_id, user_id, message, level) VALUES ($1,$2,$3,'info')", [
      project.id, req.user.id, "Project started"
    ]);
    res.json({ message: "Project started", output: result.stdout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/stop", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, user_id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    await pm2.pm2Stop(req.params.id);
    await pool.query("UPDATE projects SET status='stopped', updated_at=NOW() WHERE id=$1", [req.params.id]);
    await pool.query("INSERT INTO logs (project_id, user_id, message, level) VALUES ($1,$2,'Project stopped','info')", [
      req.params.id, req.user.id
    ]);
    res.json({ message: "Project stopped" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/restart", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, user_id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    await pm2.pm2Restart(req.params.id);
    await pool.query("INSERT INTO logs (project_id, user_id, message, level) VALUES ($1,$2,'Project restarted','info')", [
      req.params.id, req.user.id
    ]);
    res.json({ message: "Project restarted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/install", async (req, res) => {
  const { packages, manager = "npm" } = req.body;
  if (!packages || !Array.isArray(packages) || packages.length === 0)
    return res.status(400).json({ error: "packages array required" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    let result;
    if (manager === "pip") {
      result = await pm2.installPipPackages(req.params.id, packages);
    } else {
      result = await pm2.installNpmPackages(req.params.id, packages);
    }
    await pool.query("INSERT INTO logs (project_id, user_id, message, level) VALUES ($1,$2,$3,'info')", [
      req.params.id, req.user.id, `Installed packages: ${packages.join(", ")} via ${manager}`
    ]);
    res.json({ output: result.stdout, errors: result.stderr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
