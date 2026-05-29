const { spawn, execSync } = require("child_process");

let currentUrl = null;
let connected = false;
let ngrokProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  // Kill any existing ngrok http process cleanly
  try { execSync("pkill -f 'ngrok http'", { stdio: "ignore" }); } catch (_) {}
  await sleep(800);

  const env = {
    ...process.env,
    // ngrok v3 reads NGROK_AUTHTOKEN (no underscore between AUTH and TOKEN)
    NGROK_AUTHTOKEN: process.env.NGROK_AUTH_TOKEN,
  };

  // --log=stdout makes ngrok write structured log lines to stdout instead of
  // opening an interactive TUI. The "started tunnel" line contains the URL.
  ngrokProcess = spawn("ngrok", ["http", String(port), "--log=stdout"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve) => {
    let settled = false;

    function finish(url) {
      if (settled) return;
      settled = true;
      if (url) {
        currentUrl = url;
        connected = true;
      }
      resolve(url);
    }

    // Parse every line ngrok writes to stdout
    let buffer = "";
    ngrokProcess.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (!line.trim()) continue;

        // Log the raw line so the user can see what ngrok is saying
        console.log("[Ngrok]", line.trim());

        // ngrok text format:  msg="started tunnel" url=https://xxxx.ngrok-free.app
        // ngrok json format:  {"msg":"started tunnel","url":"https://..."}
        const urlMatch =
          line.match(/\burl=(https?:\/\/\S+)/) ||
          line.match(/"url"\s*:\s*"(https?:\/\/[^"]+)"/) ||
          line.match(/Forwarding\s+(https?:\/\/\S+)/);

        if (urlMatch) {
          console.log(`[Ngrok] Tunnel active: ${urlMatch[1]}`);
          finish(urlMatch[1]);
        }

        // Surface auth and connection errors immediately
        if (/ERR_NGROK_\d+/.test(line) || /authentication failed/i.test(line)) {
          const code = (line.match(/ERR_NGROK_(\d+)/) || [])[0] || "";
          console.error(`[Ngrok] Auth/connection error ${code} — check NGROK_AUTH_TOKEN`);
          finish(null);
        }
      }
    });

    ngrokProcess.stderr.on("data", (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.error("[Ngrok stderr]", msg);
    });

    ngrokProcess.on("error", (err) => {
      console.error("[Ngrok] Could not start process:", err.message);
      console.error("[Ngrok] Verify ngrok is in PATH: run `which ngrok`");
      finish(null);
    });

    ngrokProcess.on("exit", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") return;
      if (!settled) {
        console.error(`[Ngrok] Process exited (code=${code}) before tunnel was ready`);
        finish(null);
      } else if (code !== 0 && code !== null) {
        connected = false;
        currentUrl = null;
        console.warn(`[Ngrok] Tunnel closed (code=${code}) — retrying in 15s`);
        setTimeout(() => startNgrok(port), 15000);
      }
    });

    // Hard timeout: if we haven't seen a URL after 60s, give up
    setTimeout(() => {
      if (!settled) {
        console.error("[Ngrok] No tunnel URL seen after 60s");
        console.error("[Ngrok] Tip: run `ngrok http " + port + "` manually and check for errors");
        finish(null);
      }
    }, 60000);
  });
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
