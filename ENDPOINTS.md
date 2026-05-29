# API Endpoints

Base URL: `https://YOUR-NGROK-URL.ngrok-free.app/api`

All endpoints that require authentication expect a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens are returned from `/auth/register` and `/auth/login`.

---

## Health

### `GET /health`

Check if the server is running. No auth required.

**Response**
```json
{ "status": "ok", "time": "2026-05-29T17:00:00.000Z" }
```

---

## Auth — `/auth`

### `POST /auth/register`

Create a new account. Sends a 6-digit verification email.

**Body**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "mysecretpass"
}
```

**Response `201`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "verified": false
  }
}
```

**Errors:** `400` missing fields or password too short · `409` email/username taken

---

### `POST /auth/login`

**Body**
```json
{
  "email": "alice@example.com",
  "password": "mysecretpass"
}
```

**Response `200`**
```json
{
  "token": "eyJ...",
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "user",
    "verified": true
  }
}
```

**Errors:** `401` invalid credentials · `403` account suspended

---

### `GET /auth/me` 🔒

Get the current authenticated user.

**Response `200`**
```json
{
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "user",
    "verified": true
  }
}
```

---

### `POST /auth/verify-email` 🔒

Verify email with the 6-digit code sent on registration.

**Body**
```json
{ "code": "482910" }
```

**Response `200`**
```json
{ "message": "Email verified" }
```

**Errors:** `400` invalid or expired code

---

### `POST /auth/resend-verification` 🔒

Resend the email verification code.

**Response `200`**
```json
{ "message": "Verification email sent" }
```

---

### `POST /auth/forgot-password`

Request a password reset code (sent to email). Always returns the same message to prevent user enumeration.

**Body**
```json
{ "email": "alice@example.com" }
```

**Response `200`**
```json
{ "message": "If that email exists, a reset code was sent" }
```

---

### `POST /auth/reset-password`

Reset password using the emailed code.

**Body**
```json
{
  "email": "alice@example.com",
  "code": "193847",
  "newPassword": "newstrongpassword"
}
```

**Response `200`**
```json
{ "message": "Password reset successful" }
```

**Errors:** `400` invalid/expired code, password too short

---

## Projects — `/projects` 🔒

All project endpoints require authentication. Users only see their own projects.

### `GET /projects`

List all projects for the authenticated user.

**Response `200`**
```json
{
  "projects": [
    {
      "id": 1,
      "name": "my-discord-bot",
      "description": "A fun Discord bot",
      "type": "discord-bot",
      "status": "running",
      "port": null,
      "main_file": "index.js",
      "created_at": "2026-05-01T12:00:00.000Z",
      "updated_at": "2026-05-29T10:00:00.000Z"
    }
  ]
}
```

---

### `POST /projects`

Create a new project. Automatically creates the project directory with a starter file.

**Body**
```json
{
  "name": "my-api",
  "description": "A REST API",
  "type": "nodejs",
  "main_file": "index.js",
  "port": 3000
}
```

| Field | Required | Values |
|-------|----------|--------|
| `name` | ✅ | any string |
| `description` | | any string |
| `type` | | `nodejs` `python` `discord-bot` `api` — default `nodejs` |
| `main_file` | | default `index.js` (or `main.py` for Python) |
| `port` | | integer, optional |

**Response `201`**
```json
{ "project": { "id": 2, "name": "my-api", "type": "nodejs", "status": "stopped", ... } }
```

---

### `GET /projects/:id`

Get a single project.

**Response `200`**
```json
{ "project": { "id": 1, ... } }
```

**Errors:** `404` not found or not yours

---

### `PATCH /projects/:id`

Update project metadata.

**Body** (all fields optional)
```json
{
  "name": "renamed-api",
  "description": "Updated description",
  "main_file": "app.js",
  "port": 4000
}
```

**Response `200`**
```json
{ "project": { ... } }
```

---

### `DELETE /projects/:id`

Stop the process, delete all project files, and remove from the database.

**Response `200`**
```json
{ "message": "Project deleted" }
```

---

### `POST /projects/:id/start`

Start the project using PM2.

**Response `200`**
```json
{ "message": "Project started", "output": "..." }
```

**Errors:** `500` PM2 error (e.g. syntax error in main file)

---

### `POST /projects/:id/stop`

Stop the PM2 process.

**Response `200`**
```json
{ "message": "Project stopped" }
```

---

### `POST /projects/:id/restart`

Restart the PM2 process.

**Response `200`**
```json
{ "message": "Project restarted" }
```

---

### `POST /projects/:id/install`

Install npm or pip packages into the project directory.

**Body**
```json
{
  "packages": ["express", "dotenv"],
  "manager": "npm"
}
```

| Field | Values |
|-------|--------|
| `packages` | array of package names |
| `manager` | `npm` (default) or `pip` |

**Response `200`**
```json
{
  "output": "added 57 packages in 3s\n...",
  "errors": ""
}
```

---

## Files — `/projects/:id/files` 🔒

File operations are sandboxed to the project directory. Path traversal is blocked.

### `GET /projects/:id/files`

List all files and directories as a tree (excludes `node_modules` and `.git`).

**Response `200`**
```json
{
  "files": [
    { "name": "index.js", "path": "index.js", "type": "file", "size": 245 },
    {
      "name": "src",
      "path": "src",
      "type": "dir",
      "children": [
        { "name": "routes.js", "path": "src/routes.js", "type": "file", "size": 812 }
      ]
    }
  ]
}
```

---

### `GET /projects/:id/files/read?filePath=<path>`

Read a file's contents.

**Query params**

| Param | Description |
|-------|-------------|
| `filePath` | relative path inside the project, e.g. `src/index.js` |

**Response `200`**
```json
{ "content": "const express = require('express');\n..." }
```

**Errors:** `400` filePath missing · `404` file not found

---

### `POST /projects/:id/files/write`

Create or overwrite a file. Parent directories are created automatically.

**Body**
```json
{
  "filePath": "src/utils.js",
  "content": "module.exports = {};\n"
}
```

**Response `200`**
```json
{ "message": "File saved" }
```

---

### `DELETE /projects/:id/files`

Delete a file or directory (recursive).

**Body**
```json
{ "filePath": "src/old-file.js" }
```

**Response `200`**
```json
{ "message": "Deleted" }
```

---

### `POST /projects/:id/files/mkdir`

Create a directory.

**Body**
```json
{ "dirPath": "src/handlers" }
```

**Response `200`**
```json
{ "message": "Directory created" }
```

---

### `POST /projects/:id/files/rename`

Rename or move a file or directory.

**Body**
```json
{
  "oldPath": "index.js",
  "newPath": "app.js"
}
```

**Response `200`**
```json
{ "message": "Renamed" }
```

---

## Logs — `/logs` 🔒

### `GET /logs`

Fetch activity logs for the authenticated user.

**Query params** (all optional)

| Param | Description |
|-------|-------------|
| `project_id` | filter by project |
| `level` | filter by level (`info`, `warn`, `error`) |
| `limit` | max results — default `100` |
| `offset` | pagination offset — default `0` |

**Response `200`**
```json
{
  "logs": [
    {
      "id": 55,
      "project_id": 1,
      "project_name": "my-bot",
      "message": "Project started",
      "level": "info",
      "created_at": "2026-05-29T14:30:00.000Z"
    }
  ]
}
```

---

### `GET /logs/projects/:id/live?lines=100`

Fetch the last N lines of PM2 output for a project (equivalent to `pm2 logs --lines 100`).

**Query params**

| Param | Default | Description |
|-------|---------|-------------|
| `lines` | `50` | number of log lines to return |

**Response `200`**
```json
{ "output": "0|my-bot  | Bot is online!\n0|my-bot  | ..." }
```

---

### `DELETE /logs/projects/:id`

Clear all activity logs for a project.

**Response `200`**
```json
{ "message": "Logs cleared" }
```

---

## AI Assistant — `/ai` 🔒

Powered by NVIDIA NIM — model `nvidia/gemma-3n-e2b-it`.

Requires `NVIDIA_API_KEY` in backend `.env`.

### `POST /ai/chat`

Send a message to the AI. It can answer questions, write code, and automatically apply file changes to your project.

**Body**
```json
{
  "message": "Add a /ping command that replies with Pong!",
  "project_id": 1,
  "include_files": true
}
```

| Field | Description |
|-------|-------------|
| `message` | your message (required) |
| `project_id` | include project context (optional) |
| `include_files` | send up to 5 project files as context (optional, default `false`) |

**Response `200`**
```json
{
  "reply": "I've added a /ping command to your index.js. The bot will now reply with 'Pong!' whenever a user runs /ping.",
  "thought": "User wants a ping slash command. I'll write it using discord.js.",
  "actions": [
    {
      "action": "write_file",
      "path": "index.js",
      "content": "const { Client, GatewayIntentBits } = require('discord.js');\n..."
    }
  ]
}
```

When `actions` is non-empty, the server has already written those files to disk. Restart the project to pick up the changes.

---

### `GET /ai/history`

Fetch the AI chat history.

**Query params** (all optional)

| Param | Description |
|-------|-------------|
| `project_id` | filter to a specific project's history |
| `limit` | max messages — default `50` |

**Response `200`**
```json
{
  "history": [
    { "id": 1, "role": "user", "content": "Add a ping command", "created_at": "..." },
    { "id": 2, "role": "assistant", "content": "I've added...", "created_at": "..." }
  ]
}
```

---

### `DELETE /ai/history`

Clear AI chat history.

**Query params** (all optional)

| Param | Description |
|-------|-------------|
| `project_id` | clear only this project's history; omit to clear all |

**Response `200`**
```json
{ "message": "History cleared" }
```

---

## Ngrok — `/ngrok` 🔒

### `GET /ngrok/status`

Get the current Ngrok tunnel URL.

**Response `200`**
```json
{
  "url": "https://abc123.ngrok-free.app",
  "connected": true
}
```

Returns `{ "url": null, "connected": false }` if Ngrok is not running.

---

## Admin — `/admin` 🔒👑

All admin endpoints require the `Authorization` header **and** the user must have `role = "admin"`. Admins are set directly in the database or via `PATCH /admin/users/:id/role`.

### `GET /admin/users`

List all registered users.

**Response `200`**
```json
{
  "users": [
    {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "role": "admin",
      "verified": true,
      "suspended": false,
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### `PATCH /admin/users/:id/suspend`

Suspend or unsuspend a user. Suspended users cannot log in.

**Body**
```json
{ "suspended": true }
```

**Response `200`**
```json
{ "message": "User suspended" }
```

---

### `PATCH /admin/users/:id/role`

Change a user's role.

**Body**
```json
{ "role": "admin" }
```

Accepted values: `"user"` or `"admin"`.

**Response `200`**
```json
{ "message": "Role updated to admin" }
```

---

### `DELETE /admin/users/:id`

Delete a user and all their projects (stops PM2 processes and removes files).

**Response `200`**
```json
{ "message": "User and all their projects deleted" }
```

---

### `GET /admin/projects`

List all projects across all users.

**Response `200`**
```json
{
  "projects": [
    {
      "id": 1,
      "name": "my-bot",
      "type": "discord-bot",
      "status": "running",
      "created_at": "...",
      "username": "alice",
      "email": "alice@example.com"
    }
  ]
}
```

---

### `POST /admin/projects/:id/stop`

Force-stop any user's project.

**Response `200`**
```json
{ "message": "Project stopped" }
```

---

### `DELETE /admin/projects/:id`

Force-delete any user's project.

**Response `200`**
```json
{ "message": "Project deleted" }
```

---

### `GET /admin/stats`

Platform-wide statistics.

**Response `200`**
```json
{
  "totalUsers": 42,
  "projectsByStatus": [
    { "status": "running", "count": "17" },
    { "status": "stopped", "count": "25" }
  ],
  "logsLast24h": 318
}
```

---

## Error Format

All error responses follow the same shape:

```json
{ "error": "Human-readable error message" }
```

Common status codes:

| Code | Meaning |
|------|---------|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthenticated — missing or invalid token |
| `403` | Forbidden — suspended account or insufficient role |
| `404` | Not found — resource doesn't exist or doesn't belong to you |
| `409` | Conflict — email or username already taken |
| `500` | Server error |
| `503` | Service unavailable — e.g. `NVIDIA_API_KEY` not configured |
