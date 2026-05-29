# TermuxHost

A self-hosted app hosting platform — backend runs on **Termux (Android)** via PM2 + Ngrok, frontend is a static **React + Vite** site deployable to **Vercel**.

## Structure

```
/backend    ← Node.js Express API (copy to Termux)
/frontend   ← React + Vite static site (deploy to Vercel)
```

## Quick Start

### Backend (Termux)
See [TERMUX_SETUP.md](./TERMUX_SETUP.md)

### Frontend (Vercel)
See [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Long random string (32+ chars) |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `EMAIL_USER` | Gmail address |
| `EMAIL_PASS` | Gmail App Password |
| `NGROK_AUTH_TOKEN` | Ngrok auth token |
| `NVIDIA_API_KEY` | NVIDIA API key for AI features |
| `PORT` | Server port (default: `3001`) |
| `PROJECTS_ROOT` | Where project files are stored |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Your Ngrok URL or custom domain |

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Register |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/verify-email` | Verify email |
| `POST` | `/api/auth/forgot-password` | Request reset |
| `POST` | `/api/auth/reset-password` | Reset password |
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create project |
| `DELETE` | `/api/projects/:id` | Delete project |
| `POST` | `/api/projects/:id/start` | Start project |
| `POST` | `/api/projects/:id/stop` | Stop project |
| `POST` | `/api/projects/:id/restart` | Restart project |
| `POST` | `/api/projects/:id/install` | Install packages |
| `GET` | `/api/projects/:id/files` | List files |
| `GET` | `/api/projects/:id/files/read` | Read file |
| `POST` | `/api/projects/:id/files/write` | Write file |
| `DELETE` | `/api/projects/:id/files` | Delete file |
| `GET` | `/api/logs` | Activity logs |
| `GET` | `/api/logs/projects/:id/live` | PM2 live logs |
| `POST` | `/api/ai/chat` | AI assistant |
| `GET` | `/api/ai/history` | AI history |
| `GET` | `/api/ngrok/status` | Ngrok URL |
| `GET` | `/api/admin/users` | (Admin) List users |
| `PATCH` | `/api/admin/users/:id/suspend` | (Admin) Suspend user |
| `DELETE` | `/api/admin/users/:id` | (Admin) Delete user |
| `GET` | `/api/admin/stats` | (Admin) Stats |
