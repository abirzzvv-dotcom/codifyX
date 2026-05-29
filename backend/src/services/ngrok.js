const { spawn, execSync } = require("child_process");

let currentUrl = null;
let connected = false;
let ngrokProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printDnsFix() {
  console.error("[Ngrok] ─────────────────────────────────────────────────────");
  console.error("[Ngrok] DNS ERROR: Termux cannot resolve ngrok hostnames.");
  console.error("[Ngrok] This is a Termux DNS misconfiguration — not a code bug.");
  console.error("[Ngrok]");
  console.error("[Ngrok] Run these two commands in Termux, then restart:");
  console.error("[Ngrok]");
  console.error('[Ngrok]   echo "nameserver 8.8.8.8" > $PREFIX/etc/resolv.conf');
  console.error('[Ngrok]   echo "nameserver 8.8.4.4" >> $PREFIX/etc/resolv.conf');
  console.error("[Ngrok]");
  console.error("[Ngrok] Then verify DNS works:  ping -c1 connect.ngrok-agent.com");
  console.error("[Ngrok] ─────────────────────────────────────────────────────");
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  try { execSync("pkill -f 'ngrok http'", { stdio: "ignore" }); } catch (_) {}
  await sleep(800);

  const env = {
    ...process.env,
    NGROK_AUTHTOKEN: process.env.NGROK_AUTH_TOKEN,
  };

  ngrokProcess = spawn("ngrok", ["http", String(port), "--log=stdout"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve) => {
    let settled = false;
    let dnsErrorSeen = false;
    let authErrorSeen = false;

    function finish(url) {
      if (settled) return;
      settled = true;
      if (url) {
        currentUrl = url;
        connected = true;
      }
      resolve(url);
    }

    let buffer = "";
    ngrokProcess.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        // Suppress noise — only show meaningful lines
        const isNoise =
          line.includes("no configuration paths supplied") ||
          line.includes("FIPS 140") ||
          line.includes("failed to check for update") ||
          line.includes("unable to check interfaces");

        if (!isNoise) {
          console.log("[Ngrok]", line.trim());
        }

        // ── Tunnel URL ──────────────────────────────────────────────────
        const urlMatch =
          line.match(/\burl=(https?:\/\/\S+)/) ||
          line.match(/"url"\s*:\s*"(https?:\/\/[^"]+)"/) ||
          line.match(/Forwarding\s+(https?:\/\/\S+)/);

        if (urlMatch) {
          console.log(`[Ngrok] ✓ Tunnel active: ${urlMatch[1]}`);
          console.log(`[Ngrok]   Set VITE_API_URL=${urlMatch[1]} in Vercel`);
          finish(urlMatch[1]);
          return;
        }

        // ── DNS failure ─────────────────────────────────────────────────
        if (!dnsErrorSeen && (
          line.includes("connection refused") && line.includes(":53") ||
          line.includes("lookup connect.ngrok-agent.com")
        )) {
          dnsErrorSeen = true;
          printDnsFix();
          finish(null);
          return;
        }

        // ── Auth failure ────────────────────────────────────────────────
        if (!authErrorSeen && (
          line.includes("ERR_NGROK_105") ||
          line.includes("authentication failed") ||
          line.includes("invalid tunnel authtoken")
        )) {
          authErrorSeen = true;
          console.error("[Ngrok] Auth error — check NGROK_AUTH_TOKEN in your .env");
          console.error("[Ngrok] Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken");
          finish(null);
          return;
        }
      }
    });

    ngrokProcess.stderr.on("data", (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.error("[Ngrok stderr]", msg);
    });

    ngrokProcess.on("error", (err) => {
      console.error("[Ngrok] Could not start process:", err.message);
      if (err.code === "ENOENT") {
        console.error("[Ngrok] ngrok binary not found — follow Step 4b in TERMUX_SETUP.md");
      }
      finish(null);
    });

    ngrokProcess.on("exit", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") return;
      if (!settled) {
        console.error(`[Ngrok] Exited (code=${code}) before tunnel was established`);
        finish(null);
      } else if (code !== 0 && code !== null && !dnsErrorSeen && !authErrorSeen) {
        connected = false;
        currentUrl = null;
        console.warn(`[Ngrok] Tunnel closed — retrying in 15s`);
        setTimeout(() => startNgrok(port), 15000);
      }
    });

    setTimeout(() => {
      if (!settled) {
        console.error("[Ngrok] Timed out after 60s — no tunnel URL received");
        console.error("[Ngrok] Try running `ngrok http " + port + "` manually to see what fails");
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
