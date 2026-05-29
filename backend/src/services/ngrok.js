const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

let currentUrl = null;
let connected = false;
let ngrokProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Patch the ngrok config file to include dns_resolver_ips.
 * This fixes the [::1]:53 DNS issue on Termux/Android where the ngrok
 * binary reads the system /etc/resolv.conf (which has ::1) instead of
 * Termux's $PREFIX/etc/resolv.conf.
 */
function patchNgrokConfig() {
  const configDir = path.join(os.homedir(), ".config", "ngrok");
  const configPath = path.join(configDir, "ngrok.yml");

  try {
    fs.mkdirSync(configDir, { recursive: true });

    let content = "";
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, "utf-8");
    }

    // Remove any existing dns_resolver_ips block so we can rewrite it cleanly
    content = content
      .split("\n")
      .filter((line) => !/^\s*(dns_resolver_ips|  - 8\.8\.)/.test(line))
      .join("\n")
      .trimEnd();

    // Append the DNS override
    content += `\ndns_resolver_ips:\n  - 8.8.8.8\n  - 8.8.4.4\n`;

    fs.writeFileSync(configPath, content, "utf-8");
    console.log("[Ngrok] Config patched with dns_resolver_ips (8.8.8.8, 8.8.4.4)");
  } catch (err) {
    console.warn("[Ngrok] Could not patch config:", err.message);
  }
}

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set — skipping tunnel");
    return null;
  }

  // Patch config BEFORE spawning — fixes Android system DNS pointing to ::1
  patchNgrokConfig();

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
    let dnsErrorCount = 0;

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

        // Suppress noisy but harmless lines
        const isNoise =
          line.includes("no configuration paths supplied") ||
          line.includes("FIPS 140") ||
          line.includes("failed to check for update") ||
          line.includes("unable to check interfaces");
        if (!isNoise) console.log("[Ngrok]", line.trim());

        // ── Tunnel URL — success ─────────────────────────────────────
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

        // ── DNS failure — give clear fix ─────────────────────────────
        if (
          (line.includes("connection refused") && line.includes(":53")) ||
          line.includes("lookup connect.ngrok-agent.com")
        ) {
          dnsErrorCount++;
          // Only print the fix message once; the config patch should fix it on restart
          if (dnsErrorCount === 1) {
            console.error("[Ngrok] ─────────────────────────────────────────");
            console.error("[Ngrok] DNS ERROR — ngrok cannot resolve hostnames.");
            console.error("[Ngrok] The config patch should fix this on restart.");
            console.error("[Ngrok] If it persists, run in Termux:");
            console.error("[Ngrok]   pkg install dnsutils");
            console.error("[Ngrok]   nslookup connect.ngrok-agent.com 8.8.8.8");
            console.error("[Ngrok] ─────────────────────────────────────────");
            finish(null);
          }
          return;
        }

        // ── Auth failure ─────────────────────────────────────────────
        if (
          line.includes("ERR_NGROK_105") ||
          /authentication failed/i.test(line) ||
          line.includes("invalid tunnel authtoken")
        ) {
          console.error("[Ngrok] Auth error — verify NGROK_AUTH_TOKEN in .env");
          console.error("[Ngrok]   https://dashboard.ngrok.com/get-started/your-authtoken");
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
      console.error("[Ngrok] Could not spawn process:", err.message);
      if (err.code === "ENOENT") {
        console.error("[Ngrok] Install ngrok binary — see Step 6 in TERMUX_SETUP.md");
      }
      finish(null);
    });

    ngrokProcess.on("exit", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") return;
      if (!settled) {
        console.error(`[Ngrok] Exited (code=${code}) before tunnel was ready`);
        finish(null);
      } else if (code !== 0 && code !== null) {
        connected = false;
        currentUrl = null;
        console.warn("[Ngrok] Tunnel closed — retrying in 15s");
        setTimeout(() => startNgrok(port), 15000);
      }
    });

    setTimeout(() => {
      if (!settled) {
        console.error("[Ngrok] Timed out after 60s — run `ngrok http " + port + "` manually to debug");
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
