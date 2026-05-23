# LAN Terminal — Localhost-First Binding & Settings Design Spec

**Date:** 2026-05-23  
**Status:** Draft (pending user review)

---

## Overview

Change `lan-terminal` so it does **not** expose the LAN network interface on startup. Default bind is `127.0.0.1` with a localhost-only TLS certificate. Users opt in to LAN access from a **Settings** page in the web UI (shadcn-vue). When LAN is enabled, the server rebinds to `0.0.0.0`, regenerates TLS to include the LAN IP, and shows a shareable URL and QR code containing a **single-use invite token** in the query string.

The existing **startup token** auth workflow is unchanged for manual login. Invite tokens are separate, short-lived, and only embedded in LAN share links.

---

## Goals

| Goal | Detail |
|------|--------|
| Localhost-first | No LAN port exposure until user explicitly enables it in Settings |
| UI opt-in | LAN toggle + confirmation + URL/QR on a dedicated Settings page |
| Preserve auth | Startup token → `POST /auth` → `HttpOnly` `sid` cookie → WS via cookie |
| Easy pairing | QR encodes `https://<LAN-IP>:<port>/?invite=<token>` for other devices |
| Safe invites | Invite tokens are single-use, short TTL, distinct from startup token |

---

## Non-Goals

- CLI flags for LAN (`--lan`) — LAN is controlled only from Settings UI
- Persistent LAN mode across server restarts (restart returns to localhost-only)
- Multi-session / per-device tokens (unchanged: one active session globally)

---

## Startup Behavior

1. Bind HTTPS server to **`127.0.0.1`** (not `0.0.0.0`).
2. Generate/reuse TLS cert for **`localhost` only** (no LAN IP in cert until LAN enabled).
3. Print to console:
   - One-time **startup access token** (32-byte hex, 1-hour expiry — unchanged).
   - `https://localhost:<port>/` only — **no LAN URL** on startup.
4. `LanState.mode` = `"localhost"`.

---

## Settings UI

### Navigation

- View state in `App.vue`: `login` | `terminal` | `settings` (no vue-router in v1).
- Gear icon in terminal header → Settings; back control returns to terminal.
- Settings requires an authenticated session (same as terminal).

### Components

| Component | Purpose |
|-----------|---------|
| `Settings.vue` | Settings page layout |
| `LanShareCard.vue` | URL, copy button, QR, regenerate link (visible when LAN on) |

### shadcn-vue components

**Add:** `switch`, `label`, `alert-dialog`, `separator`  
**Reuse:** `card`, `button`

### Enable LAN flow

1. User toggles **Allow LAN access** → `AlertDialog`: “Anyone on your Wi‑Fi can reach this terminal. Continue?”
2. On confirm → `POST /api/settings/lan` `{ "enabled": true }` (loading state on switch).
3. On success → show `LanShareCard` with URL + QR; toast if WebSocket reconnects.
4. On failure → revert switch, show inline error.

### Disable LAN flow

1. User toggles off → `AlertDialog`: “Stop LAN access?”
2. `POST /api/settings/lan` `{ "enabled": false }` → hide share card; server rebinding to localhost.

### QR & share URL

- URL format: `https://<LAN-IP>:<port>/?invite=<invite-token>`
- QR encodes full URL (small dep e.g. `qrcode`).
- Helper text: “Link expires in 15 minutes · one-time use”
- **Regenerate link** → `POST /api/settings/lan/refresh-invite` → new invite, invalidates previous.

### State sync

- On Settings mount: `GET /api/settings/lan` → sync switch and share card if LAN already enabled.

---

## Invite Token

Separate from the startup access token.

| Property | Value |
|----------|--------|
| Purpose | LAN device pairing via URL/QR only |
| TTL | 15 minutes from mint |
| Usage | **Single-use** — invalidated after one successful `POST /auth` |
| Visibility | Only in Settings share URL/QR when LAN enabled |
| Invalidation | Used, expired, LAN disabled, or refresh-invite |

### Login with invite

1. Device opens `https://<LAN-IP>:<port>/?invite=<token>`.
2. `Login.vue` reads `invite` query param on mount → auto `POST /auth` with that value.
3. On success: set session cookie, `history.replaceState` to remove query from address bar.
4. On failure: show error (“Invite link expired” / “already used”) with option to enter startup token manually.

`POST /auth` accepts **either** a valid startup token **or** a valid unused, unexpired invite token.

---

## Server Architecture

### Bind modes (Approach 1: rebind)

| Mode | Bind host | TLS SANs | Console URL |
|------|-----------|----------|---------------|
| `localhost` | `127.0.0.1` | `localhost` | `https://localhost:<port>/` |
| `lan` | `0.0.0.0` | `localhost`, `<LAN-IP>` | (no LAN URL on CLI; share via UI only) |

Toggle triggers: close HTTPS server + WSS → `ensureTLS(hosts)` → `serve()` with new hostname → reattach WS upgrade handler.

### Server state

```ts
type BindMode = "localhost" | "lan";

interface LanState {
  mode: BindMode;
  inviteToken: string | null;
  inviteExpiresAt: number | null;
  inviteUsed: boolean;
}
```

### API (cookie-authenticated via `sid`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/settings/lan` | — | `{ enabled, lanUrl?, inviteExpiresAt? }` |
| `POST` | `/api/settings/lan` | `{ enabled: boolean }` | `{ enabled, lanUrl?, inviteExpiresAt? }` |
| `POST` | `/api/settings/lan/refresh-invite` | — | `{ lanUrl, inviteExpiresAt }` |

- `lanUrl` includes `?invite=` only when LAN enabled and invite is active.
- `POST` enable: rebind + mint invite.
- `POST` disable: rebind localhost + clear invite.
- `refresh-invite`: invalidate old, mint new (LAN must be enabled).

All settings routes return `401` without valid session cookie.

---

## Authentication (unchanged + invite)

### Startup token (unchanged)

- Generated at server start; printed to console.
- 1-hour expiry; single global token.
- Manual entry on Login page.

### Session (unchanged)

- `POST /auth` success → `sid` HttpOnly cookie, `SameSite=Strict`, `Secure`, 1h max-age.
- WebSocket `/ws` validates `sid` only (no token in WS URL).
- One active session; `409` if occupied.
- Session ends on WS close.

### Invite path

- Same `POST /auth` endpoint; invite validated before startup token.
- Success with invite → `inviteUsed = true`.
- Expired invite → `401` “Invite link expired — ask host to regenerate”.
- Used invite → `401` “Invite link already used”.

---

## TLS (`server/tls.ts`)

- **localhost mode:** `ensureTLS()` with hosts `["localhost"]` only.
- **lan mode:** `ensureTLS(lanIP)` with `["localhost", lanIP]`; regenerate if cached cert missing LAN IP.
- Cert cache dir unchanged: `~/.lan-terminal/certs/`.

---

## Error Handling

| Case | HTTP / UX |
|------|-----------|
| Enable LAN, no LAN IP found | `503` + revert switch |
| Rebind failure | `500` + revert switch |
| Settings API without session | `401` |
| Invite expired / used | `401` with specific message on Login |
| Active session conflict | `409` (unchanged) |

---

## Development

- `npm run dev`: server defaults to localhost-only on port 3001; Vite proxy to `https://localhost:3001` unchanged.
- Direct `tsx` run of `server/index.ts` follows same localhost-first rules.

---

## Dependencies

- `qrcode` (or equivalent) for QR generation in `LanShareCard.vue`.

---

## Testing

| Area | Cases |
|------|--------|
| Binding | Default `127.0.0.1`; after enable `0.0.0.0`; after disable back to loopback |
| Invite | Mint, single-use consume, expiry, refresh invalidates prior |
| Auth | `POST /auth` with startup token, invite token, used invite, expired invite |
| API | Settings routes require `sid`; return correct `lanUrl` shape |
| TLS | localhost-only cert at start; LAN cert includes LAN IP after enable |

---

## Security Notes

- LAN opt-in reduces accidental exposure on untrusted networks.
- Invite in URL is a deliberate tradeoff for pairing convenience; mitigated by single-use, 15-minute TTL, LAN-only minting, and query stripping after login.
- Startup token is never placed in URL or QR.
- Invite auth only meaningful while LAN mode is enabled (server bound to LAN).

---

## File Changes (implementation reference)

| Area | Files |
|------|--------|
| Server | `server/index.ts`, `server/app.ts`, new `server/lan.ts`, `server/invite.ts` |
| TLS | `server/tls.ts` (host list per mode) |
| CLI | `cli/index.ts` (localhost URL only) |
| Frontend | `App.vue`, `Settings.vue`, `LanShareCard.vue`, `Login.vue`, `Terminal.vue` (header gear) |
| shadcn | Add switch, label, alert-dialog, separator |
