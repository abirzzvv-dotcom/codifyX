const { spawn, execSync } = require("child_process");
const http = require("http");

let currentUrl = null;
let connected = false;
let ngrokProcess = null;

function queryNgrokApi() {
  return new Promise((resolve, reject) => {
    const req = http.get("http://localhost:4040/api/tunnels", (res) => {
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
    req.on("error", reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set, skipping");
    return null;
  }

  try { execSync("pkill -f 'ngrok http'", { stdio: "ignore" }); } catch (_) {}
  await sleep(500);

  const args = [
    "http", String(port),
    `--authtoken=${process.env.NGROK_AUTH_TOKEN}`,
    "--log=stdout",
    "--log-format=json",
  ];

  ngrokProcess = spawn("ngrok", args, { stdio: ["ignore", "pipe", "pipe"] });

  ngrokProcess.on("error", (err) => {
    console.error("[Ngrok] Failed to spawn:", err.message);
    console.error("[Ngrok] Make sure ngrok is installed: https://ngrok.com/download");
  });

  ngrokProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      connected = false;
      console.warn(`[Ngrok] Process exited (code ${code}), reconnecting in 10s...`);
      setTimeout(() => startNgrok(port), 10000);
    }
  });

  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(1000);
    try {
      const url = await queryNgrokApi();
      if (url) {
        currentUrl = url;
        connected = true;
        console.log(`[Ngrok] Public URL: ${url}`);
        return url;
      }
    } catch (_) {}
  }

  console.error("[Ngrok] Timed out waiting for tunnel — check your NGROK_AUTH_TOKEN and that ngrok is installed");
  return null;
}

function stopNgrok() {
  if (ngrokProcess) {
    ngrokProcess.kill();
    ngrokProcess = null;
  }
  connected = false;
  currentUrl = null;
}

function getNgrokUrl() {
  return { url: currentUrl, connected };
}

module.exports = { startNgrok, stopNgrok, getNgrokUrl };
