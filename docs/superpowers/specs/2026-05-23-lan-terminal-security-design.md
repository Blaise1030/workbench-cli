# LAN Terminal — Security & CLI Design Spec

**Date:** 2026-05-23  
**Status:** Approved

---

## Overview

Harden the existing LAN web terminal by fixing its key security gaps, then package it as a distributable CLI installable via `npx` or `brew`. The result is a single command that auto-configures TLS, starts a secure HTTPS server, and opens a login-gated terminal in the browser.

---

## Security Gaps Addressed

| Gap | Fix |
|-----|-----|
| Token exposed in URL | Token exchanged via `POST /auth`, never in URL |
| No TLS — traffic sniffable | HTTPS via `mkcert`-generated cert |
| No session limit | One active session at a time |
| Token never expires | Token expires 1 hour after server startup |
| No Origin check on WS upgrade | WebSocket validated via `HttpOnly` cookie |

---

## Architecture

```
lan-terminal (npm package / brew formula)
├── bin/
│   └── lan-terminal            ← compiled JS entrypoint (built artifact)
├── cli/
│   └── index.ts                ← CLI entrypoint (TypeScript source)
├── server/
│   ├── index.ts                ← Hono HTTPS server + WebSocket upgrade
│   ├── token.ts                ← token gen, expiry, single-session guard
│   ├── tls.ts                  ← mkcert detection, install, cert generation
│   └── pty.ts                  ← PTY spawn + resize (unchanged)
├── src/                        ← Vue 3 + shadcn-vue frontend
│   ├── App.vue
│   └── components/
│       ├── Login.vue           ← token entry form
│       └── Terminal.vue        ← terminal (shown post-auth)
└── package.json
```

### Build pipeline

- `cli/` and `server/` compiled by `tsc` → `dist/`
- `src/` built by Vite → `dist/public/`
- `package.json#bin` points to `dist/cli/index.js`
- `prepublish` runs full build automatically

### Scripts

| Script | Action |
|--------|--------|
| `dev` | `tsx watch server/index.ts` + `vite` (concurrent) |
| `build` | `tsc && vite build` |
| `start` | `node bin/lan-terminal` |
| `prepublish` | `npm run build` |

---

## Startup Flow

1. CLI runs → checks for `mkcert` in PATH
2. If missing: detect OS → `brew install mkcert` (macOS) / `apt install mkcert` (Linux) / print manual install instructions (Windows)
3. Run `mkcert -install` (installs local CA — one-time per machine)
4. Generate cert for `localhost` + detected LAN IP; cache to `~/.lan-terminal/certs/`
5. Reuse cached certs on subsequent runs; regenerate if LAN IP changes
6. Start HTTPS server on `0.0.0.0:3000`
7. Print one-time token + `https://<LAN-IP>:3000` to console
8. User opens URL → Login page → enters token → terminal

---

## Authentication & Session

### Token

- 32-byte hex string generated at startup via `node:crypto`
- Expires 1 hour after server start
- Single global token (not per-client)

### `POST /auth`

Request body: `{ "token": "<value>" }`

Validation order:
1. Token matches server token → `401` if not
2. Token not expired → `401 Token expired — restart the server` if expired
3. No active session → `409 Another session is already active` if occupied

On success:
- Mark session active
- Set cookie: `sid=<random-session-id>; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
- Return `200 OK`

### WebSocket Upgrade (`/ws`)

- Parse `Cookie` header, extract `sid`
- Validate `sid` against active session record
- Reject with `401` if missing or invalid
- No token in query string

### Session Lifecycle

- Session becomes inactive when WebSocket closes (allows re-login)
- Session cookie `Max-Age` matches token expiry (1 hour)

---

## TLS Setup (`server/tls.ts`)

```
checkMkcert()
  → not found: installMkcert() based on OS
installLocalCA()          // mkcert -install (skipped if already done)
generateCert(hosts)       // mkcert localhost <LAN-IP>
cacheCerts(~/.lan-terminal/certs/)
```

- Cert cache keyed by LAN IP; stale certs regenerated automatically
- `tls.ts` exports `{ key, cert }` buffers consumed by the HTTPS server

---

## Frontend

### Setup

```
npx shadcn-vue@latest init --preset a2LMozI --template vite
```

### Components

**`Login.vue`**
- Card layout: password input + submit button (shadcn-vue `Card`, `Input`, `Button`)
- `POST /auth` on submit
- Error states:
  - Invalid token → "Invalid token"
  - Expired → "Token expired — restart the server"
  - Session occupied → "Another session is active"
- On success: emit `authenticated` event → `App.vue` swaps to `Terminal`

**`Terminal.vue`** (existing, minor changes)
- Remove token prop and URL query string logic
- WebSocket connects to `wss://<host>/ws` — cookie sent automatically by browser
- No other changes

**`App.vue`**
- State: `authenticated: boolean`
- Renders `<Login>` or `<Terminal>` based on state
- No token handling in URL or localStorage

---

## Distribution

### npm / npx

- Package name: `lan-terminal`
- `package.json#bin`: `{ "lan-terminal": "dist/cli/index.js" }`
- `npx lan-terminal` works with no prior install

### Homebrew

- Brew formula taps the npm package via `npm install -g lan-terminal`
- Formula lives in a separate tap repo (out of scope for this spec)

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `mkcert` install fails | Print instructions, exit with code 1 |
| Cert generation fails | Print error, exit with code 1 |
| PTY spawn fails | Close WebSocket, log error (existing behaviour) |
| Token expired on WS connect | `401`, browser shows "Token expired" message |
| Second session attempt | `409`, browser shows "Another session is active" |

---

## Out of Scope

- Windows `mkcert` auto-install (manual instructions printed instead)
- Multi-user / multiple simultaneous sessions
- Brew formula tap repo
- Token refresh without server restart
