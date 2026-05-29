const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const { authenticate } = require("../middleware/auth");

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "nvidia/gemma-3n-e2b-it";

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

async function callNvidia(messages) {
  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      temperature: 0.5,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function buildSystemPrompt(projectContext) {
  return `You are an expert AI coding assistant integrated into a hosting platform.
You help users debug, write, and modify code for their hosted projects.

When asked to edit or create files, respond with a JSON object in this exact format:
{
  "thought": "brief explanation of what you are doing",
  "actions": [
    { "action": "write_file", "path": "relative/path/to/file.js", "content": "full file content here" },
    { "action": "delete_file", "path": "relative/path/to/file.js" }
  ],
  "message": "explanation to the user"
}

If you are just answering a question without file changes, respond with:
{
  "thought": "...",
  "actions": [],
  "message": "your answer here"
}

Always produce complete, working code. Never truncate or leave TODO comments.
${projectContext ? `\nCurrent project context:\n${projectContext}` : ""}`;
}

router.use(authenticate);

router.post("/chat", async (req, res) => {
  const { message, project_id, include_files } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  if (!process.env.NVIDIA_API_KEY) {
    return res.status(503).json({ error: "NVIDIA_API_KEY not configured" });
  }

  try {
    let projectContext = "";
    if (project_id) {
      const { rows } = await pool.query(
        "SELECT * FROM projects WHERE id=$1 AND user_id=$2",
        [project_id, req.user.id]
      );
      if (rows[0]) {
        projectContext = `Project: ${rows[0].name} (${rows[0].type}), main: ${rows[0].main_file}`;

        if (include_files) {
          const dir = projectDir(project_id);
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter((f) => !f.startsWith(".") && f !== "node_modules");
            const snippets = [];
            for (const f of files.slice(0, 5)) {
              const fp = path.join(dir, f);
              if (fs.statSync(fp).isFile()) {
                const content = fs.readFileSync(fp, "utf-8").slice(0, 2000);
                snippets.push(`--- ${f} ---\n${content}`);
              }
            }
            if (snippets.length) projectContext += `\n\nFiles:\n${snippets.join("\n\n")}`;
          }
        }
      }
    }

    const { rows: history } = await pool.query(
      "SELECT role, content FROM ai_history WHERE user_id=$1 AND project_id IS NOT DISTINCT FROM $2 ORDER BY created_at DESC LIMIT 10",
      [req.user.id, project_id || null]
    );
    const historyMessages = history.reverse().map((h) => ({ role: h.role, content: h.content }));

    const messages = [
      { role: "system", content: buildSystemPrompt(projectContext) },
      ...historyMessages,
      { role: "user", content: message },
    ];

    const rawReply = await callNvidia(messages);

    let parsed;
    try {
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { thought: "", actions: [], message: rawReply };
    } catch {
      parsed = { thought: "", actions: [], message: rawReply };
    }

    if (parsed.actions && parsed.actions.length > 0 && project_id) {
      const { rows: pRows } = await pool.query(
        "SELECT id FROM projects WHERE id=$1 AND user_id=$2",
        [project_id, req.user.id]
      );
      if (pRows[0]) {
        for (const action of parsed.actions) {
          if (action.action === "write_file" && action.path && action.content !== undefined) {
            const full = safePath(project_id, action.path);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, action.content, "utf-8");
          } else if (action.action === "delete_file" && action.path) {
            const full = safePath(project_id, action.path);
            if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
          }
        }
      }
    }

    await pool.query(
      "INSERT INTO ai_history (user_id, project_id, role, content) VALUES ($1,$2,'user',$3)",
      [req.user.id, project_id || null, message]
    );
    await pool.query(
      "INSERT INTO ai_history (user_id, project_id, role, content) VALUES ($1,$2,'assistant',$3)",
      [req.user.id, project_id || null, parsed.message || rawReply]
    );

    res.json({
      reply: parsed.message || rawReply,
      actions: parsed.actions || [],
      thought: parsed.thought || "",
    });
  } catch (err) {
    console.error("[AI/chat]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/history", async (req, res) => {
  const { project_id, limit = 50 } = req.query;
  try {
    const { rows } = await pool.query(
      "SELECT id, role, content, created_at FROM ai_history WHERE user_id=$1 AND project_id IS NOT DISTINCT FROM $2 ORDER BY created_at ASC LIMIT $3",
      [req.user.id, project_id || null, parseInt(limit)]
    );
    res.json({ history: rows });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.delete("/history", async (req, res) => {
  const { project_id } = req.query;
  try {
    await pool.query(
      "DELETE FROM ai_history WHERE user_id=$1 AND project_id IS NOT DISTINCT FROM $2",
      [req.user.id, project_id || null]
    );
    res.json({ message: "History cleared" });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

module.exports = router;
