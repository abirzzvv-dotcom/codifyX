#!/usr/bin/env node
/**
 * TermuxHost setup checker
 * Run from the backend directory: node check-setup.js
 */
require("dotenv").config();
const { execSync } = require("child_process");
const dns = require("dns");
const http = require("http");

let passed = 0;
let failed = 0;
let warned = 0;

function ok(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}
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

function checkBinary(name) {
  try {
    execSync(`which ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkDns(hostname) {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err) => resolve(!err));
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

  // ── Binaries ─────────────────────────────────────────────────────────────
  console.log("[ Binaries ]");
  checkBinary("node") ? ok("node") : fail("node", "pkg install nodejs");
  checkBinary("npm")  ? ok("npm")  : fail("npm",  "pkg install nodejs");
  checkBinary("pm2")  ? ok("pm2")  : fail("pm2",  "npm install -g pm2");
  checkBinary("ngrok") ? ok("ngrok") : fail("ngrok", "See Step 4b in TERMUX_SETUP.md — download the ARM binary");
  checkBinary("git")  ? ok("git")  : warn("git (optional)", "pkg install git");
  console.log();

  // ── Environment variables ─────────────────────────────────────────────────
  console.log("[ Environment (.env) ]");
  process.env.DATABASE_URL
    ? ok("DATABASE_URL is set")
    : fail("DATABASE_URL missing", "Add it to backend/.env — get a free DB at neon.tech");
  process.env.JWT_SECRET
    ? ok("JWT_SECRET is set")
    : fail("JWT_SECRET missing", 'Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.env.NGROK_AUTH_TOKEN
    ? ok("NGROK_AUTH_TOKEN is set")
    : warn("NGROK_AUTH_TOKEN not set", "Ngrok tunnel will be skipped — get token at dashboard.ngrok.com");
  process.env.NVIDIA_API_KEY
    ? ok("NVIDIA_API_KEY is set")
    : warn("NVIDIA_API_KEY not set", "AI assistant will be disabled — get key at build.nvidia.com");
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? ok("EMAIL_USER + EMAIL_PASS set")
    : warn("Email not configured", "Email verification will be skipped — set EMAIL_USER and EMAIL_PASS");
  console.log();

  // ── DNS resolution ────────────────────────────────────────────────────────
  console.log("[ DNS ]");
  const dnsNeon  = await checkDns("neon.tech");
  const dnsNgrok = await checkDns("connect.ngrok-agent.com");
  const dns8888  = await checkDns("google.com");

  dns8888  ? ok("DNS resolves google.com")            : fail("DNS broken — cannot resolve google.com");
  dnsNeon  ? ok("DNS resolves neon.tech")              : fail("DNS broken for neon.tech");
  dnsNgrok ? ok("DNS resolves connect.ngrok-agent.com") : fail(
    "DNS cannot resolve connect.ngrok-agent.com",
    'Fix: echo "nameserver 8.8.8.8" > $PREFIX/etc/resolv.conf && echo "nameserver 8.8.4.4" >> $PREFIX/etc/resolv.conf'
  );
  console.log();

  // ── Database connection ───────────────────────────────────────────────────
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

  // ── Server running? ───────────────────────────────────────────────────────
  console.log("[ Server ]");
  const port = parseInt(process.env.PORT) || 3001;
  const serverUp = await checkPort(port);
  serverUp
    ? ok(`Server responding at localhost:${port}`)
    : warn(`Server not running on port ${port}`, "Start with: node server.js");
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════");
  console.log(`  ${passed} passed  ${warned} warnings  ${failed} failed`);
  console.log("══════════════════════════════════════\n");

  if (failed > 0) {
    console.log("Fix the failed checks above, then run `node check-setup.js` again.\n");
    process.exit(1);
  } else if (warned > 0) {
    console.log("Warnings won't stop the server from running.\n");
  } else {
    console.log("Everything looks good! Start the server with: node server.js\n");
  }
}

main().catch((err) => {
  console.error("Checker error:", err.message);
  process.exit(1);
});
