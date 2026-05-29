# Vercel Deployment Guide

Deploy the TermuxHost frontend to Vercel so you can access your hosting dashboard from any browser.

---

## Prerequisites

- Your backend is running on Termux and you have a public Ngrok URL (see [TERMUX_SETUP.md](./TERMUX_SETUP.md))
- A [Vercel](https://vercel.com) account (free tier works)
- The frontend code in `/frontend`

---

## Option A — Vercel Dashboard (recommended)

### 1. Push your code to GitHub

```bash
git init
git add .
git commit -m "init"
gh repo create termuxhost --public --push
# or use git remote add origin ... && git push
```

### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Add GitHub account"** and authorize Vercel
3. Find and import your repository
4. In the **Configure Project** screen:
   - **Framework Preset:** Vite *(auto-detected)*
   - **Root Directory:** `frontend` *(important if your repo contains both `/backend` and `/frontend`)*
   - Leave Build Command and Output Directory as default

### 3. Set the environment variable

Still on the Configure screen, expand **Environment Variables** and add:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://abc123.ngrok-free.app` ← your Ngrok URL |

### 4. Deploy

Click **Deploy**. Vercel builds and hosts the app in ~30 seconds.

Your frontend is now live at `https://your-project.vercel.app`.

---

## Option B — Vercel CLI

```bash
npm install -g vercel
cd frontend
vercel
```

When prompted:
- **Set up and deploy?** → `Y`
- **Which scope?** → your account
- **Link to existing project?** → `N`
- **Project name:** `termuxhost` (or anything)
- **Directory:** `./` (you're already in `/frontend`)

After the first deploy, set the env var:

```bash
vercel env add VITE_API_URL production
# paste your Ngrok URL when prompted
vercel --prod   # redeploy with the new env var
```

---

## Keeping the API URL Up to Date

Ngrok free tier generates a **new URL every time** it restarts. After restarting your backend:

1. Note the new Ngrok URL from the terminal or from the dashboard at `GET /api/ngrok/status`
2. Update it in Vercel:
   - Dashboard → your project → **Settings** → **Environment Variables** → edit `VITE_API_URL`
   - Go to **Deployments** → click the three dots on the latest deployment → **Redeploy**

**Tip:** Upgrade to a paid Ngrok plan ($8/mo) to get a stable static domain — then you never need to update this again.

---

## Running the Frontend Locally

```bash
cd frontend
npm install

# Create env file
cp .env.example .env
# Edit .env and set VITE_API_URL to your Ngrok URL or http://localhost:3001

npm run dev
# Opens at http://localhost:5173
```

Leave `VITE_API_URL` empty (or unset) to use relative URLs — this works when running against a local backend on the same machine.

---

## Custom Domain (optional)

1. Vercel Dashboard → your project → **Settings** → **Domains**
2. Add your domain (e.g. `hosting.yourdomain.com`)
3. Add the CNAME record Vercel shows you in your DNS provider
4. Wait for DNS propagation (~5 min)

Once set up, update your `VITE_API_URL` to your custom domain if you also put Ngrok behind it, or keep using the Ngrok URL — the frontend is just a static site, so only the API URL matters.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page after deploy | Check the **Vercel build logs** for errors; most common cause is wrong Root Directory |
| `VITE_API_URL` not picked up | Make sure the variable name starts with `VITE_` — Vite only exposes those to the browser |
| Login fails (network error) | Your Ngrok URL has changed — update `VITE_API_URL` in Vercel and redeploy |
| `Failed to fetch` on all requests | CORS is open on the backend, so this is almost always a wrong or expired Ngrok URL |
| Build error: `Cannot find module` | The frontend only uses React and Vite — if you added packages, run `npm install` locally first to make sure `package.json` is correct |
