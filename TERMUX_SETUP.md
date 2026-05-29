# Termux Setup Guide

## 1. Install Termux

Download from [F-Droid](https://f-droid.org/packages/com.termux/) (not Play Store).

## 2. Update Termux

```bash
pkg update && pkg upgrade -y
```

## 3. Install Dependencies

```bash
pkg install nodejs git -y
npm install -g pm2
```

To enable email features (optional):
```bash
pkg install python -y
```

## 4. Clone or Copy the Backend

**Option A — Copy from this repo:**
Copy the `/backend` folder to your Termux home directory.

**Option B — Git:**
```bash
git clone <your-repo-url>
cd <repo>/backend
```

## 5. Install Node Packages

```bash
cd ~/backend
npm install
```

## 6. Create Your .env File

```bash
cp .env.example .env
nano .env
```

Fill in:
- `DATABASE_URL` — your Neon PostgreSQL URL
- `JWT_SECRET` — a long random string
- `EMAIL_USER` / `EMAIL_PASS` — Gmail + App Password
- `NGROK_AUTH_TOKEN` — from ngrok.com/dashboard
- `NVIDIA_API_KEY` — from build.nvidia.com (for AI features)

## 7. Set Up Ngrok

```bash
npm install -g ngrok
ngrok config add-authtoken YOUR_TOKEN
```

Or just put `NGROK_AUTH_TOKEN` in your `.env` — the server handles it automatically.

## 8. Start the Server

**Development (foreground):**
```bash
node server.js
```

**Production with PM2 (recommended):**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

The server starts on port 3001 by default.
Ngrok will print a public URL — use that as `VITE_API_URL` in your frontend.

## 9. Verify It Works

```bash
curl http://localhost:3001/api/health
```

Should return: `{"status":"ok","time":"..."}`

## 10. Keep Termux Running

- Use **Termux:Boot** to auto-start PM2 on device boot.
- Acquire a wakelock: `termux-wake-lock`
- Or use a persistent notification to keep Termux alive.

## Updating the Backend

```bash
cd ~/backend
git pull   # or copy new files
npm install
pm2 restart hosting-backend
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot find module 'express'` | Run `npm install` in `/backend` |
| DB connection error | Check `DATABASE_URL` in `.env`, ensure Neon allows your IP |
| Ngrok auth error | Run `ngrok config add-authtoken YOUR_TOKEN` |
| PM2 not found | Run `npm install -g pm2` |
| Port already in use | Change `PORT` in `.env` |
