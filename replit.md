# TermuxHost

A self-hosted app hosting platform. Backend runs on **Termux (Android)** via PM2 + Ngrok. Frontend is a static **React + Vite** site for **Vercel**.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — start the backend (reads from `/backend/server.js`)
- `pnpm --filter @workspace/web run dev` — start the frontend preview
- Backend installs its own deps from `/backend/package.json` on first run

## Stack

- **Backend** (`/backend`): Node.js + Express, Neon PostgreSQL, JWT, bcrypt, Nodemailer, Ngrok, PM2
- **Frontend** (`/frontend` + `artifacts/web`): React + Vite, plain CSS, fetch API
- pnpm workspaces for Replit preview wiring only

## Where things live

- `/backend/server.js` — main Express entry point
- `/backend/src/routes/` — auth, projects, files, logs, ai, admin, ngrok
- `/backend/src/services/` — email (Gmail SMTP), ngrok, pm2
- `/backend/src/db.js` — Neon PostgreSQL schema + pool
- `/backend/.env.example` — all required environment variables
- `/frontend/` — standalone Vercel-deployable React app
- `artifacts/web/src/` — TypeScript mirror of frontend for Replit preview
- `TERMUX_SETUP.md` — full Termux setup guide
- `VERCEL_DEPLOY.md` — Vercel deployment guide

## Architecture decisions

- Backend is plain CommonJS (no TypeScript, no build step) for maximum Termux compatibility
- `artifacts/api-server` runs `node ../../backend/server.js` directly — no separate entry point
- Frontend uses `import.meta.env.VITE_API_URL || ""` fallback — empty string = relative URLs for Replit, full Ngrok URL for Vercel
- No API keys, no CORS restrictions — security is purely the Ngrok URL being private
- PM2 is used as a CLI tool (not as a module dep) — installed globally on Termux via `npm install -g pm2`

## Product

- Register/login with JWT auth + email verification
- Create Node.js, Python, Discord bot, and API projects
- Start/stop/restart projects via PM2
- Install npm/pip packages from the UI
- Browse and edit project files in-browser
- View PM2 live logs and activity logs
- AI assistant (NVIDIA Gemma 3n) that can debug, create, and edit files

## User preferences

- Frontend simplicity is a priority — plain CSS, minimal dependencies
- Backend must run on Termux without Docker or Linux-only deps
- Environment variables via `VITE_API_URL` for frontend, `.env` for backend
- No hardcoded URLs anywhere

## Gotchas

- Backend deps are in `/backend/node_modules` (not pnpm workspace) — run `npm install` in `/backend` on first setup
- PM2 must be installed globally on Termux: `npm install -g pm2`
- Ngrok free tier changes URL on restart — update `VITE_API_URL` in Vercel when it changes
- `DATABASE_URL` must be set or the server starts with a warning and DB features fail
- Gmail requires an App Password (not account password) for SMTP

## Pointers

- See `TERMUX_SETUP.md` for full Termux + PM2 + Ngrok setup
- See `VERCEL_DEPLOY.md` for deploying the frontend to Vercel
- See `README.md` for full API endpoint reference
