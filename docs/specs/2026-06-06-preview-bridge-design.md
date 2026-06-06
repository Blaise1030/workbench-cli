# Preview Bridge

A live preview feature for browser-sidecar that mirrors Cursor's browser panel concept — but between two browser tabs instead of embedded in the IDE. The IDE detects running dev servers from terminal output, and `Cmd+click` opens a proxy-wrapped preview tab that stays in sync with the IDE.

## Scope

- Terminal URL detection with click / Cmd+click behaviour
- Go reverse proxy that injects a control script into HTML responses
- WebSocket hub on the Go backend relaying messages between IDE and preview tabs
- Auto-refresh preview on file save
- Element selection mode in the preview tab — captures CSS selector + screenshot and pastes into the active IDE terminal

Out of scope for v1: bidirectional navigation, click-to-source-file, cross-origin support.

---

## 1. Terminal URL detection

The terminal panel parses each output line with a regex for `https?://localhost:\d+(/\S*)?`. Matched URLs are rendered as clickable links inline in the terminal output.

- **Normal click** → `window.open(url)` — opens raw dev server in new tab
- **Cmd+click** → `window.open('/sidecar/proxy?target=' + encodeURIComponent(url))` — opens via sidecar proxy

No new toolbar, button, or sidebar chrome needed. Works with any framework that prints a local URL on boot (Vite, Next.js, SvelteKit, etc.).

---

## 2. New pnpm package: `sidecar-client`

A standalone package in the monorepo responsible for the injected browser script.

```
sidecar-client/
  package.json        ← name: @browser-sidecar/sidecar-client
  vite.config.ts      ← lib mode, iife format, single entry
  src/
    index.ts          ← pill UI + WebSocket client + selection logic
  dist/
    client.js         ← output embedded by Go
```

Added to `pnpm-workspace.yaml`. Built as part of `pnpm -r build`. VanJS bundled directly into the output — no host app dependencies required.

---

## 3. Go backend — new endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/sidecar/proxy` | GET | Reverse proxy to `?target=` URL. Rewrites HTML responses to inject `<script src="/sidecar/client.js">` before `</body>`. Proxies all other assets (JS, CSS, images) transparently. |
| `/sidecar/client.js` | GET | Serves the bundled client script. Embedded via `//go:embed sidecar-client/dist/client.js`. |
| `/sidecar/ws` | WS | WebSocket hub. Accepts connections from both IDE tab and proxy tab. Relays all messages to all other connected clients. |

---

## 4. WebSocket message protocol

All messages are JSON.

```
IDE tab → proxy tab:
  { "type": "refresh" }

Proxy tab → IDE tab:
  { "type": "element-selected", "selector": ".card > h2", "screenshot": "<base64 png>" }
```

The hub does not interpret messages — it relays them to all other connected clients.

---

## 5. File save → refresh

When the IDE frontend detects a file save (existing file-save hook), it sends `{ type: "refresh" }` over the `/sidecar/ws` WebSocket. The proxy tab's `client.js` receives this and calls `location.reload()`.

---

## 6. Injected client.js behaviour

The script is injected into every HTML response from the proxy. It:

1. Opens a WebSocket connection to `/sidecar/ws`
2. Listens for `{ type: "refresh" }` → calls `location.reload()`
3. Mounts the selection mode pill into a **Shadow DOM** host at the bottom-left of the page (`position: fixed`) to prevent style bleed in both directions
4. In selection mode: attaches `mouseover` / `mouseout` listeners to apply/remove a temporary `outline: 2px solid #89b4fa` inline style on hovered elements
5. On click in selection mode: captures the element's CSS selector and a screenshot of its bounding box, then sends `element-selected` to the WS hub, then deactivates selection mode

### Selection pill (VanJS + Shadow DOM)

```
┌─────────────────────┐  ← Shadow root (isolated styles)
│  ● Select           │  ← dot: grey=off, green=on
└─────────────────────┘
  bottom: 16px; left: 16px; position: fixed
```

Built with VanJS reactive state — dot colour and cursor update automatically when `active` state toggles.

### CSS selector capture

Walk the element's ancestor chain building a selector from `tagName` + `id` (if present, stop there) or significant class names. Stops at `<body>`. Avoids dynamic/generated class names (e.g. CSS modules hashes) by skipping classes matching `/^[a-z]+-[a-z0-9]{4,}$/i`.

### Screenshot capture

Use the Canvas API + `element.getBoundingClientRect()` with `html2canvas` (bundled into `sidecar-client`) to capture the element bounding box. Encode as base64 PNG and include in the `element-selected` message.

---

## 7. IDE: receiving element-selected

When the IDE tab receives `{ type: "element-selected" }` over the WS:

1. Paste the selector as a line into the active terminal input
2. Paste the screenshot as an inline image into the terminal (if the terminal supports it via OSC 8 / iTerm2 protocol) — fall back to a `[screenshot attached]` placeholder if not supported

---

## 8. Build pipeline

```
pnpm -r build
  └─ sidecar-client: vite build → dist/client.js
  └─ frontend: vite build → server-go/internal/embed/
  └─ server-go: go build (embeds sidecar-client/dist/client.js)
```

`server-go` uses `//go:embed` pointed at `../../sidecar-client/dist/client.js` relative to the embed directive file.

---

## 9. What is not built

- No browser extension
- No click-to-source-file (bidirectional navigation)
- No CSS tweaking / live edit from preview
- No multi-target proxy (one dev server at a time per WS session)
