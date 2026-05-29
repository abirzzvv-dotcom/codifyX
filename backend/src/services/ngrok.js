const { spawn, execSync } = require("child_process");
const http = require("http");

let currentUrl = null;
let connected = false;
let ngrokProcess = null;

function queryNgrokApi() {
  return new Promise((resolve, reject) => {
    const req = http.get("http://localhost:4040/api/tunnels", { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const body = JSON.parse(data);
          const tunnel = (body.tunnels || []).find((t) => t.proto === "https");
          resolve(tunnel ? tunnel.public_url : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  // Kill any stale ngrok processes
  try { execSync("pkill -f 'ngrok http'", { stdio: "ignore" }); } catch (_) {}
  await sleep(800);

  const env = {
    ...process.env,
    NGROK_AUTHTOKEN: process.env.NGROK_AUTH_TOKEN,
  };

  ngrokProcess = spawn("ngrok", ["http", String(port), "--log=stdout", "--log-format=json"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const errorLines = [];

  ngrokProcess.stdout.on("data", (data) => {
    for (const raw of data.toString().split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        const msg = entry.msg || "";
        const lvl = (entry.lvl || entry.level || "").toLowerCase();
        if (lvl === "error" || lvl === "crit") {
          errorLines.push(msg || line);
          console.error("[Ngrok]", msg || line);
        } else if (msg.includes("started tunnel") || msg.includes("client session")) {
          console.log("[Ngrok] Agent ready");
        }
      } catch {
        if (line.includes("error") || line.includes("ERR")) {
          errorLines.push(line);
          console.error("[Ngrok]", line);
        }
      }
    }
  });

  ngrokProcess.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) {
      errorLines.push(msg);
      console.error("[Ngrok stderr]", msg);
    }
  });

  ngrokProcess.on("error", (err) => {
    console.error("[Ngrok] Failed to spawn process:", err.message);
    console.error("[Ngrok] Make sure ngrok is installed and in PATH");
  });

  ngrokProcess.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGKILL") return;
    connected = false;
    currentUrl = null;
    if (code !== 0 && code !== null) {
      console.warn(`[Ngrok] Exited with code ${code} — retrying in 15s`);
      if (errorLines.length > 0) {
        console.error("[Ngrok] Last errors:", errorLines.slice(-3).join(" | "));
      }
      setTimeout(() => startNgrok(port), 15000);
    }
  });

  // Poll the ngrok local API until the tunnel is up (up to 45 seconds)
  console.log("[Ngrok] Waiting for tunnel...");
  for (let i = 0; i < 45; i++) {
    await sleep(1000);

    if (ngrokProcess.exitCode !== null && ngrokProcess.exitCode !== 0) {
      console.error("[Ngrok] Process exited early — check auth token and ngrok installation");
      return null;
    }

    const url = await queryNgrokApi();
    if (url) {
      currentUrl = url;
      connected = true;
      console.log(`[Ngrok] Tunnel active: ${url}`);
      return url;
    }
  }

  console.error("[Ngrok] Timed out after 45s waiting for tunnel");
  if (errorLines.length > 0) {
    console.error("[Ngrok] Errors seen:", errorLines.slice(-5).join(" | "));
  }
  return null;
}

function stopNgrok() {
  if (ngrokProcess) {
    ngrokProcess.kill("SIGTERM");
    ngrokProcess = null;
  }
  connected = false;
  currentUrl = null;
}

function getNgrokUrl() {
  return { url: currentUrl, connected };
}

module.exports = { startNgrok, stopNgrok, getNgrokUrl };
