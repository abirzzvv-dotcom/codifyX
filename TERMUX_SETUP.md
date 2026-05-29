# Termux Setup Guide

This guide walks you through turning your Android device into a backend server running TermuxHost.

---

## Prerequisites

- Android device (Android 7+)
- Termux installed from **[F-Droid](https://f-droid.org/packages/com.termux/)** — do **not** use the Play Store version, it is outdated
- A [Neon](https://neon.tech) account (free PostgreSQL)
- A [Ngrok](https://ngrok.com) account (free tunnel)
- A [build.nvidia.com](https://build.nvidia.com) API key (free, for AI features)

---

## Step 1 — Install Termux from F-Droid

1. Open F-Droid → search "Termux" → install
2. Open Termux

---

## Step 2 — Update packages

```bash
pkg update && pkg upgrade -y
```

---

## Step 3 — Install Node.js and Git

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

## Step 4 — Install PM2 globally

PM2 keeps your projects running and auto-restarts them on crash.

```bash
npm install -g pm2
```

Verify:

```bash
pm2 --version
```

---

## Step 4b — Install the ngrok binary

The backend spawns `ngrok` as a CLI command — **do not** use `npm install ngrok`. Instead install the real binary:

```bash
# Download the ARM64 binary (most modern Android devices)
cd ~
curl -o ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
tar xzf ngrok.tgz
mv ngrok $PREFIX/bin/ngrok
chmod +x $PREFIX/bin/ngrok
rm ngrok.tgz
```

If your device is 32-bit ARM:
```bash
curl -o ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz
```

Verify:
```bash
ngrok version
# ngrok version 3.x.x
```

---

## Step 5 — (Optional) Install Python

Only needed if you want to host Python projects.

```bash
pkg install python -y
pip install --upgrade pip
```

---

## Step 6 — Get the backend onto your device

**Option A — Clone from GitHub:**

```bash
git clone https://github.com/YOUR_USERNAME/termuxhost.git
cd termuxhost/backend
```

**Option B — Copy the `/backend` folder manually** using a file manager or `adb push`.

---

## Step 7 — Install Node dependencies

```bash
cd ~/termuxhost/backend   # or wherever your backend folder is
npm install
```

---

## Step 8 — Create your `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in the values:

```env
# Database — get this from neon.tech → your project → Connection string
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require

# Auth — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-long-random-secret-here
JWT_EXPIRES_IN=7d

# Server
PORT=3001
PROJECTS_ROOT=./data/projects

# Ngrok — get from dashboard.ngrok.com
NGROK_AUTH_TOKEN=your_ngrok_authtoken_here

# NVIDIA AI — get from build.nvidia.com
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxx

# Gmail SMTP — use an App Password, not your account password
# Google Account → Security → 2-Step Verification → App passwords
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

---

## Step 9 — Configure Ngrok auth

The server spawns the `ngrok` binary automatically — no separate setup needed. Just make sure `NGROK_AUTH_TOKEN` is in your `.env` (you already did this in Step 8).

The server logs the public URL on startup. You can also check it at `GET /api/ngrok/status`.

---

## Step 10 — Test the server

Run it in the foreground first to check for errors:

```bash
node server.js
```

You should see:

```
[DB] Schema initialized
[Server] Running on port 3001
[Server] API base: http://localhost:3001/api
[Ngrok] Tunnel started: https://abc123.ngrok-free.app
```

Test the health endpoint:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","time":"2026-..."}
```

Stop it with `Ctrl+C` once confirmed.

---

## Step 11 — Run with PM2 (production)

```bash
pm2 start ecosystem.config.js
pm2 save
```

Set PM2 to auto-start on device boot:

```bash
pm2 startup
# Copy and run the command it outputs, then:
pm2 save
```

Useful PM2 commands:

```bash
pm2 list                      # see all processes
pm2 logs hosting-backend      # tail the server logs
pm2 restart hosting-backend   # restart after code changes
pm2 stop hosting-backend      # stop the server
pm2 delete hosting-backend    # remove from PM2
```

---

## Step 12 — Keep Termux alive

Android aggressively kills background apps. Do at least one of these:

**Option A — Wakelock (simplest):**
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
cd ~/termuxhost/backend
pm2 resurrect
EOF
chmod +x ~/.termux/boot/start.sh
```

**Option C — Battery optimization:**
Go to Android Settings → Battery → find Termux → set to "Unrestricted" or "Don't optimize".

---

## Step 13 — Connect the frontend

The Ngrok URL printed on startup is your `VITE_API_URL`. Copy it and set it in your Vercel environment variables.

See [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) for the full frontend setup.

---

## Updating the Backend

```bash
cd ~/termuxhost
git pull
cd backend
npm install          # only needed if package.json changed
pm2 restart hosting-backend
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module 'express'` | Run `npm install` in the `/backend` folder |
| `DATABASE_URL not set` or DB errors | Check your `.env`, make sure the Neon URL is correct and includes `?sslmode=require` |
| `NVIDIA_API_KEY not configured` | Add `NVIDIA_API_KEY` to `.env`, get one at build.nvidia.com |
| `ngrok: command not found` | Follow Step 4b — download the ngrok binary manually |
| Ngrok auth error | Check `NGROK_AUTH_TOKEN` in `.env`; get your token at dashboard.ngrok.com |
| `PM2 not found` | Run `npm install -g pm2` |
| Port already in use | Change `PORT` in `.env` to something else (e.g. `3002`) |
| Email verification not sending | Make sure `EMAIL_USER` and `EMAIL_PASS` are set; use a Gmail **App Password**, not your account password |
| Termux process killed by Android | Set battery optimization to "Unrestricted" for Termux; use `termux-wake-lock` |
| `pm2 resurrect` fails on boot | Run `pm2 save` after starting the server to snapshot the process list |
| Frontend can't reach backend | Make sure Ngrok is running — check `GET /api/ngrok/status` — and that `VITE_API_URL` in Vercel matches the current Ngrok URL |
