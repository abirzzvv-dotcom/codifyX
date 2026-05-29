require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { initDB } = require("./src/db");
const { startNgrok } = require("./src/services/ngrok");

const authRoutes = require("./src/routes/auth");
const projectRoutes = require("./src/routes/projects");
const fileRoutes = require("./src/routes/files");
const logRoutes = require("./src/routes/logs");
const aiRoutes = require("./src/routes/ai");
const adminRoutes = require("./src/routes/admin");
const ngrokRoutes = require("./src/routes/ngrok");

const app = express();
const PORT = parseInt(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", fileRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ngrok", ngrokRoutes);

app.use((err, req, res, next) => {
  console.error("[Error]", err.stack || err.message);
  res.status(500).json({ error: "Internal server error" });
});

const PROJECTS_ROOT = path.resolve(process.env.PROJECTS_ROOT || "./data/projects");
fs.mkdirSync(PROJECTS_ROOT, { recursive: true });

async function start() {
  // Step 1 — Database
  if (!process.env.DATABASE_URL) {
    console.warn("[DB] WARNING: DATABASE_URL not set — database features will fail");
  } else {
    try {
      await initDB();
    } catch (err) {
      console.error("[DB] Failed to initialize:", err.message);
    }
  }

  // Step 2 — Start Express, wait until listening
  await new Promise((resolve) => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Server] API base: http://localhost:${PORT}/api`);
      resolve();
    });
  });

  // Step 3 — Ngrok (after server is confirmed listening)
  if (process.env.NGROK_AUTH_TOKEN) {
    startNgrok(PORT).then((url) => {
      if (url) {
        console.log(`[Ngrok] Public URL: ${url}`);
        console.log(`[Ngrok] Set VITE_API_URL=${url} in your Vercel project`);
      }
    });
  } else {
    console.log("[Ngrok] Skipped — set NGROK_AUTH_TOKEN in .env to enable");
  }
}

start().catch((err) => {
  console.error("[Fatal]", err.message);
  process.exit(1);
});
