# Termux Setup Guide

This guide turns your Android phone into a backend server running TermuxHost. Follow every step in order.

---

## Step 1 — Install Termux from F-Droid

Download from **[F-Droid](https://f-droid.org/packages/com.termux/)** — do **not** use the Play Store version, it is outdated and broken.

Open Termux after installing.

---

## Step 2 — Update packages

```bash
pkg update && pkg upgrade -y
```

---

## Step 3 — Fix DNS (critical — do this before anything else)

Termux sometimes ships with a broken DNS config that points at `[::1]:53` (localhost) instead of a real nameserver. This causes ngrok and other network tools to fail with "connection refused" DNS errors even when your internet works fine.

**Fix it now before you hit the issue:**

```bash
echo "nameserver 8.8.8.8" > $PREFIX/etc/resolv.conf
echo "nameserver 8.8.4.4" >> $PREFIX/etc/resolv.conf
```

Verify DNS works:

```bash
ping -c 2 google.com
# Should print ping replies, not "Name or service not known"
```

If ping works, you're good. This fix persists across Termux restarts.

---

## Step 4 — Install Node.js and Git

```bash
pkg install nodejs git -y
```

Verify:

```bash
node --version   # v20+
npm --version
git --version
```

---

## Step 5 — Install PM2

PM2 keeps your projects running and restarts them on crash.

```bash
npm install -g pm2
pm2 --version   # verify
```

---

## Step 6 — Install the ngrok binary

The backend spawns ngrok as a CLI process. Install the real ARM binary — **do not** `npm install ngrok`.

**Most phones (64-bit ARM):**
```bash
cd ~
curl -o ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
tar xzf ngrok.tgz
mv ngrok $PREFIX/bin/ngrok
chmod +x $PREFIX/bin/ngrok
rm ngrok.tgz
```

**Older phones (32-bit ARM):**
```bash
cd ~
curl -o ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz
tar xzf ngrok.tgz
mv ngrok $PREFIX/bin/ngrok
chmod +x $PREFIX/bin/ngrok
rm ngrok.tgz
```

Verify:
```bash
ngrok version   # should print: ngrok version 3.x.x
```

---

## Step 7 — (Optional) Install Python

Only needed if you want to host Python projects.

```bash
pkg install python -y
pip install --upgrade pip
```

---

## Step 8 — Get the backend onto your device

**Option A — Clone from GitHub:**
```bash
git clone https://github.com/YOUR_USERNAME/codifyX.git
cd codifyX/backend
```

**Option B — Copy the `/backend` folder manually** using a file manager or `adb push`.

---

## Step 9 — Install Node dependencies

```bash
cd ~/codifyX/backend
npm install
```

---

## Step 10 — Create your `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in every value:

```env
# ── Database ────────────────────────────────────────────────────────────────
# Get from: neon.tech → your project → Connection string → Node.js
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require

# ── Auth ─────────────────────────────────────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-long-random-secret-here
JWT_EXPIRES_IN=7d

# ── Server ───────────────────────────────────────────────────────────────────
PORT=3001
PROJECTS_ROOT=./data/projects

# ── Ngrok ────────────────────────────────────────────────────────────────────
# Get from: dashboard.ngrok.com → Your Authtoken
NGROK_AUTH_TOKEN=your_ngrok_authtoken_here

# ── NVIDIA AI (optional) ─────────────────────────────────────────────────────
# Get from: build.nvidia.com → Get API Key
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxx

# ── Gmail SMTP (optional) ────────────────────────────────────────────────────
# Use an App Password — NOT your account password
# Google Account → Security → 2-Step Verification → App passwords
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
```

Save: `Ctrl+O` then `Ctrl+X`.

---

## Step 11 — Run the setup checker

This checks everything before you start the server:

```bash
node check-setup.js
```

Expected output:
```
  ✓  node
  ✓  npm
  ✓  pm2
  ✓  ngrok
  ✓  DATABASE_URL is set
  ✓  JWT_SECRET is set
  ✓  NGROK_AUTH_TOKEN is set
  ✓  DNS resolves google.com
  ✓  DNS resolves neon.tech
  ✓  DNS resolves connect.ngrok-agent.com
  ✓  PostgreSQL connection successful
```

Fix any `✗` failures before continuing. `⚠` warnings are optional features.

---

## Step 12 — Start the server

```bash
node server.js
```

Expected output (in order):

```
[DB] Schema initialized
[Server] Running on port 3001
[Server] API base: http://localhost:3001/api
[Ngrok] Waiting for tunnel...
[Ngrok] t=... lvl=info msg="client session established"
[Ngrok] t=... lvl=info msg="started tunnel" url=https://xxxx.ngrok-free.app
[Ngrok] ✓ Tunnel active: https://xxxx.ngrok-free.app
[Ngrok]   Set VITE_API_URL=https://xxxx.ngrok-free.app in Vercel
```

Test it:
```bash
curl http://localhost:3001/api/health
# {"status":"ok","time":"..."}
```

Stop with `Ctrl+C` once confirmed.

---

## Step 13 — Run with PM2 (production)

```bash
pm2 start ecosystem.config.js
pm2 save
```

Auto-start on device boot:
```bash
pm2 startup
# Run the command it prints, then:
pm2 save
```

Useful commands:
```bash
pm2 list                       # see all processes
pm2 logs hosting-backend       # live log output
pm2 restart hosting-backend    # after code changes
pm2 stop hosting-backend       # stop
pm2 delete hosting-backend     # remove from PM2
```

---

## Step 14 — Keep Termux alive

Android kills background apps aggressively. Use at least one of these:

**Option A — Wakelock:**
```bash
termux-wake-lock
```

**Option B — Termux:Boot (recommended):**
1. Install [Termux:Boot](https://f-droid.org/packages/com.termux.boot/) from F-Droid
2. Open it once to register the boot receiver
3. Create the auto-start script:

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd ~/codifyX/backend
pm2 resurrect
EOF
chmod +x ~/.termux/boot/start.sh
```

**Option C — Battery settings:**
Android Settings → Battery → Termux → set to **Unrestricted** or **Don't optimize**.

---

## Step 15 — Connect the frontend

Copy the Ngrok URL from the startup log and set it in Vercel as `VITE_API_URL`.

See [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) for the full Vercel setup.

---

## Updating

```bash
cd ~/codifyX
git pull
cd backend
npm install        # only if package.json changed
pm2 restart hosting-backend
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| DNS errors (`[::1]:53 connection refused`) | Step 3 — run the two `echo nameserver` commands |
| `Cannot find module 'express'` | `npm install` in the `backend/` folder |
| `[DB] Failed to initialize` | Check `DATABASE_URL` in `.env` — must include `?sslmode=require` |
| `ngrok: command not found` | Step 6 — download the ARM binary manually |
| `[Ngrok] Auth error` | Check `NGROK_AUTH_TOKEN` in `.env` at dashboard.ngrok.com |
| `[Ngrok] Timed out` | Run `node check-setup.js` — almost always a DNS issue (Step 3) |
| `PM2 not found` | `npm install -g pm2` |
| Port already in use | Change `PORT` in `.env` |
| Email not sending | Use a Gmail **App Password**, not account password |
| Termux killed by Android | Battery → Termux → Unrestricted; use `termux-wake-lock` |
| `pm2 resurrect` fails on boot | Run `pm2 save` after the server starts successfully |
| Frontend can't reach backend | Ngrok URL changed — update `VITE_API_URL` in Vercel |
