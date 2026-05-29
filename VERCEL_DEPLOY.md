# Vercel Deployment Guide

## Prerequisites

- Your backend is running on Termux and has a public Ngrok URL
- A [Vercel](https://vercel.com) account

## 1. Prepare the Frontend

The `/frontend` folder is a self-contained Vite + React app.
Copy it to its own GitHub repository (or push the whole repo and set the root to `frontend/`).

## 2. Deploy to Vercel

### Option A — Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Set **Root Directory** to `frontend` if your repo contains both folders
4. Vercel auto-detects Vite — no build config needed
5. Add environment variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://your-ngrok-url.ngrok-free.app`
6. Deploy

### Option B — Vercel CLI

```bash
npm install -g vercel
cd frontend
vercel --prod
```

Set env var when prompted, or via dashboard after deploy.

## 3. Update the API URL

Every time your Ngrok URL changes (free tier), update `VITE_API_URL` in Vercel:
- Dashboard → Project → Settings → Environment Variables
- Redeploy (or it applies to next deploy automatically)

**Tip:** Use a paid Ngrok plan or a custom domain for a stable URL.

## 4. Verify

Open your Vercel URL → you should see the TermuxHost login page.
Try registering an account — it will hit your Termux backend.

## Running Locally (for development)

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env and set VITE_API_URL to your ngrok URL or http://localhost:3001
npm run dev
```
