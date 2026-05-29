#!/usr/bin/env node
/**
 * TermuxHost setup checker
 * Run from the backend directory: node check-setup.js
 */
require("dotenv").config();
const { execSync } = require("child_process");
const dns = require("dns");
const http = require("http");
const fs = require("fs");

let passed = 0;
let failed = 0;
let warned = 0;

function ok(label)   { console.log(`  ✓  ${label}`); passed++; }
function fail(label, hint) {
  console.log(`  ✗  ${label}`);
  if (hint) console.log(`       → ${hint}`);
  failed++;
}
function warn(label, hint) {
  console.log(`  ⚠  ${label}`);
  if (hint) console.log(`       → ${hint}`);
  warned++;
}

/**
 * Check a binary by trying to run it with --version.
 * More reliable than `which` in Termux child processes where PATH may differ.
 */
function checkBinary(name) {
  try {
    execSync(`${name} --version 2>/dev/null || ${name} version 2>/dev/null`, {
      stdio: "ignore",
      shell: true,
    });
    return true;
  } catch {
    // Fallback: check if the file exists in common Termux paths
    const paths = [
      `/data/data/com.termux/files/usr/bin/${name}`,
      `/data/data/com.termux/files/usr/local/bin/${name}`,
      `/data/data/com.termux/files/home/.npm-global/bin/${name}`,
      `/usr/bin/${name}`,
      `/usr/local/bin/${name}`,
    ];
    return paths.some((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });
  }
}

function checkDns(hostname) {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err) => resolve(!err));
  });
}

/**
 * Check DNS via a raw UDP query using the system resolver (like ngrok does).
 * This catches the case where Node.js DNS works but the system resolver is broken.
 */
function checkSystemDns(hostname) {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    // Use nslookup or getent to test the system resolver
    exec(`nslookup ${hostname} 8.8.8.8 2>&1 || host ${hostname} 8.8.8.8 2>&1`, (err, stdout) => {
      if (!err && stdout.includes("Address")) {
        resolve(true);
      } else {
        // Fallback: just try connecting to 8.8.8.8:53 via TCP
        const net = require("net");
        const s = net.createConnection({ host: "8.8.8.8", port: 53, timeout: 3000 });
        s.on("connect", () => { s.destroy(); resolve(true); });
        s.on("error", () => resolve(false));
        s.on("timeout", () => { s.destroy(); resolve(false); });
      }
    });
  });
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  console.log("\n══════════════════════════════════════");
  console.log("  TermuxHost Setup Checker");
  console.log("══════════════════════════════════════\n");

  // ── Binaries ──────────────────────────────────────────────────────────────
  console.log("[ Binaries ]");

  // Node is always present since we're running this script
  ok("node (running this script)");

  checkBinary("npm")  ? ok("npm")  : fail("npm",  "pkg install nodejs");
  checkBinary("pm2")  ? ok("pm2")  : fail("pm2",  "npm install -g pm2");
  checkBinary("ngrok") ? ok("ngrok") : fail(
    "ngrok",
    "See Step 6 in TERMUX_SETUP.md — download the ARM binary from ngrok.com"
  );
  checkBinary("git")  ? ok("git")  : warn("git (optional)", "pkg install git");
  console.log();

  // ── Environment variables ──────────────────────────────────────────────────
  console.log("[ Environment (.env) ]");
  process.env.DATABASE_URL
    ? ok("DATABASE_URL is set")
    : fail("DATABASE_URL missing", "Get a free DB at neon.tech, add to backend/.env");
  process.env.JWT_SECRET
    ? ok("JWT_SECRET is set")
    : fail("JWT_SECRET missing",
        "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.env.NGROK_AUTH_TOKEN
    ? ok("NGROK_AUTH_TOKEN is set")
    : warn("NGROK_AUTH_TOKEN not set", "Tunnel skipped — get token at dashboard.ngrok.com");
  process.env.NVIDIA_API_KEY
    ? ok("NVIDIA_API_KEY is set")
    : warn("NVIDIA_API_KEY not set", "AI assistant disabled — get key at build.nvidia.com");
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? ok("EMAIL_USER + EMAIL_PASS set")
    : warn("Email not configured", "Email verification will be skipped");
  console.log();

  // ── DNS ────────────────────────────────────────────────────────────────────
  console.log("[ DNS ]");

  const dnsGoogle = await checkDns("google.com");
  const dnsNeon   = await checkDns("neon.tech");
  const dnsNgrok  = await checkDns("connect.ngrok-agent.com");

  dnsGoogle ? ok("Node.js DNS: google.com")              : fail("Node.js DNS broken");
  dnsNeon   ? ok("Node.js DNS: neon.tech")               : fail("Node.js DNS: neon.tech unreachable");
  dnsNgrok  ? ok("Node.js DNS: connect.ngrok-agent.com") : fail("Node.js DNS: ngrok unreachable");

  // Check whether the system DNS (used by the ngrok binary) also works
  const sysDns = await checkSystemDns("connect.ngrok-agent.com");
  if (sysDns) {
    ok("System DNS: 8.8.8.8 reachable (ngrok binary will work)");
  } else {
    warn(
      "System DNS: cannot reach 8.8.8.8:53",
      "The ngrok config will be patched automatically on startup (dns_resolver_ips)"
    );
  }

  // Check if the ngrok config already has dns_resolver_ips
  const ngrokConfig = require("path").join(require("os").homedir(), ".config/ngrok/ngrok.yml");
  if (fs.existsSync(ngrokConfig)) {
    const cfg = fs.readFileSync(ngrokConfig, "utf-8");
    if (cfg.includes("dns_resolver_ips")) {
      ok("ngrok config has dns_resolver_ips");
    } else {
      warn("ngrok config missing dns_resolver_ips", "Will be patched automatically on next server start");
    }
  } else {
    warn("ngrok config not found", "Will be created automatically on first server start");
  }
  console.log();

  // ── Database ────────────────────────────────────────────────────────────────
  if (process.env.DATABASE_URL) {
    console.log("[ Database ]");
    try {
      const { Pool } = require("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("neon.tech") ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
      });
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      await pool.end();
      ok("PostgreSQL connection successful");
    } catch (err) {
      fail("PostgreSQL connection failed", err.message);
    }
    console.log();
  }

  // ── Server ────────────────────────────────────────────────────────────────
  console.log("[ Server ]");
  const port = parseInt(process.env.PORT) || 3001;
  const serverUp = await checkPort(port);
  serverUp
    ? ok(`Server responding at localhost:${port}`)
    : warn(`Server not running on port ${port}`, "Start with: node server.js");
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════");
  console.log(`  ${passed} passed  ${warned} warnings  ${failed} failed`);
  console.log("══════════════════════════════════════\n");

  if (failed > 0) {
    console.log("Fix the failed items above, then run `node check-setup.js` again.\n");
    process.exit(1);
  } else if (warned > 0) {
    console.log("Warnings are optional features — the server will still run.\n");
  } else {
    console.log("All good! Start the server: node server.js\n");
  }
}

main().catch((err) => {
  console.error("Checker error:", err.message);
  process.exit(1);
});
