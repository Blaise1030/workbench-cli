# LAN Web Terminal — Design Spec

**Date:** 2026-05-23  
**Stack:** Vite + Vue 3 → Hono → node-pty → PC shell  
**Terminal UI:** wterm (vercel-labs/wterm)

---

## Overview

A minimal web terminal server that runs on a PC and exposes a full shell session to any browser on the same LAN. The frontend embeds the wterm terminal emulator; the backend is a Hono server that bridges WebSocket connections to a PTY.

---

## Architecture

```
Browser (Vue + wterm)
  └─ HTTP        → Hono → serves dist/ (prod) or Vite dev server (dev)
  └─ WS /ws?token=<TOKEN> → Hono → node-pty → $SHELL
```

**Single monorepo** — one `package.json`, one repo root.

- **Dev:** Vite dev server (port 5173) proxies `/ws` to Hono (port 3001). Both run in parallel via `concurrently`.
- **Prod:** `vite build` outputs to `dist/`. Hono serves `dist/` as static files and handles `/ws` — single process, single port (default 3000).

Hono binds to `0.0.0.0` so any device on the LAN can connect.

---

## Auth: One-Time Session Token

On startup, the server:
1. Generates a token via `crypto.randomUUID()`
2. Prints to stdout:
   ```
   Access token: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Open: http://192.168.x.x:3000/?token=a1b2c3d4-...
   ```
3. Detects LAN IP automatically (first non-loopback IPv4).

**Token lifecycle:**
- Client reads `?token=` from URL, appends to WS URL as query param.
- Server checks token on WebSocket upgrade request.
- **Valid + not consumed** → accept connection, mark token as consumed.
- **Invalid / already consumed / missing** → reject with HTTP 401.
- Token is not persisted — restart generates a new one.

This means only one terminal session per server run. Restart for a new session.

---

## PTY Protocol

Follows wterm's wire format exactly:

| Direction | Message | Meaning |
|-----------|---------|---------|
| Client → Server | `\x1b[RESIZE:<cols>;<rows>]` | First message; spawns PTY with given dimensions |
| Client → Server | any other string | Write to PTY stdin |
| Server → Client | raw string | PTY stdout/stderr data |

On first RESIZE message: spawn `$SHELL` (or `/bin/zsh` fallback) with `node-pty`.  
On subsequent RESIZE messages: call `ptyProcess.resize(cols, rows)`.  
On WS close: kill PTY process.  
On PTY exit: close WS.

---

## File Structure

```
v2/
├── package.json           # scripts: dev, build, start
├── tsconfig.json
├── vite.config.ts         # proxy /ws → :3001 in dev, build → dist/
├── index.html
├── src/
│   ├── main.ts
│   ├── App.vue            # reads ?token from URL, passes to Terminal
│   └── components/
│       └── Terminal.vue   # mounts wterm, opens WS
└── server/
    └── index.ts           # Hono + ws + node-pty + token guard
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `hono` + `@hono/node-server` | HTTP server |
| `ws` | WebSocket server (attached to Hono's HTTP server) |
| `node-pty` | PTY spawning |
| `wterm` (vercel-labs/wterm) | Terminal emulator component |
| `vue` + `vite` + `@vitejs/plugin-vue` | Frontend build |
| `concurrently` | Run Vite + Hono in parallel during dev |
| `typescript` + `tsx` | TypeScript execution for server |

---

## Scripts

```json
{
  "dev":   "concurrently \"vite\" \"tsx watch server/index.ts\"",
  "build": "vite build",
  "start": "tsx server/index.ts"
}
```

---

## Environment Variables

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `3000` | Server port |
| `SHELL` | system default | Shell to spawn |

---

## Constraints & Non-Goals

- No multi-session support (one active PTY per server run by design).
- No HTTPS — LAN only, plain WS. Add a reverse proxy (Caddy/nginx) if TLS is needed.
- No shell selection UI — uses `$SHELL` env var.
- No persistent history or session replay.
