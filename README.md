# TermuxHost

A self-hosted app hosting platform. Your **Android phone running Termux** becomes a server — it runs Node.js projects, Discord bots, APIs, and Python scripts via PM2, exposed to the internet through Ngrok. A **React + Vite frontend** deployed to Vercel gives you a web UI to manage everything from any device.

```
┌─────────────────────┐        HTTPS / Ngrok        ┌──────────────────────┐
│   Vercel Frontend   │ ◄──────────────────────────► │  Termux Backend      │
│   (any browser)     │                              │  (your phone)        │
└─────────────────────┘                              └──────────────────────┘
                                                              │
                                                         PM2 processes
                                                      (your Node/Python apps)
```

---

## Features

- **Auth** — register, login, JWT sessions, email verification, password reset
- **Projects** — create Node.js, Python, Discord bot, or API projects; start/stop/restart via PM2
- **Package manager** — install npm or pip packages directly from the UI
- **File editor** — browse, create, edit, and delete project files in-browser
- **Logs** — activity log + live PM2 output per project
- **AI assistant** — NVIDIA Gemma 3n that can write, debug, and edit your files
- **Admin panel** — user management, suspension, role assignment, global stats

---

## Repository Structure

```
/backend          ← Node.js + Express API  (copy this to Termux)
/frontend         ← React + Vite static app (deploy this to Vercel)
README.md         ← this file
TERMUX_SETUP.md   ← step-by-step Termux guide
VERCEL_DEPLOY.md  ← step-by-step Vercel guide
ENDPOINTS.md      ← full API reference
```

---

## Quick Start

| Step | Guide |
|------|-------|
| 1. Set up backend on Termux | [TERMUX_SETUP.md](./TERMUX_SETUP.md) |
| 2. Deploy frontend to Vercel | [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) |
| 3. Explore the API | [ENDPOINTS.md](./ENDPOINTS.md) |

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Long random string (32+ chars) |
| `JWT_EXPIRES_IN` | | Token lifetime — default `7d` |
| `PORT` | | Server port — default `3001` |
| `PROJECTS_ROOT` | | Where project files are stored — default `./data/projects` |
| `NVIDIA_API_KEY` | | From [build.nvidia.com](https://build.nvidia.com) — required for AI features |
| `NGROK_AUTH_TOKEN` | | From [ngrok.com/dashboard](https://dashboard.ngrok.com) |
| `EMAIL_USER` | | Gmail address for verification emails |
| `EMAIL_PASS` | | Gmail **App Password** (not your account password) |

### Frontend — `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ (Vercel) | Your Ngrok public URL, e.g. `https://abc123.ngrok-free.app` |

Leave `VITE_API_URL` unset when running locally — it defaults to relative URLs.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js (CommonJS, no build step) |
| Web framework | Express 4 |
| Database | Neon PostgreSQL (serverless) |
| Process manager | PM2 (installed globally on Termux) |
| Tunnel | Ngrok |
| Auth | JWT + bcryptjs |
| Email | Nodemailer + Gmail SMTP |
| AI | NVIDIA NIM — `nvidia/gemma-3n-e2b-it` |
| Frontend | React 18 + Vite |
| Styling | Plain CSS variables (no framework) |
| Deployment | Vercel (frontend) |

---

## Design Decisions

- **CommonJS everywhere** — no TypeScript, no build step in the backend so it runs on Termux without issues
- **No CORS restrictions** — security comes from the Ngrok URL being private
- **PM2 as a CLI tool** — not a Node module, must be installed globally: `npm install -g pm2`
- **Neon PostgreSQL** — serverless Postgres that works from any IP, free tier available
- **Schema auto-created** — `initDB()` runs on server startup, no manual migrations needed

---

## Database Schema

```
users              — accounts, roles, verification status
projects           — hosted apps per user
logs               — activity log entries
ai_history         — per-user, per-project AI chat history
verification_codes — email verify + password reset codes
```
