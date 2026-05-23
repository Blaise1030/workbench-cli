# Terminal Persistence Design

**Date:** 2026-05-23  
**Goal:** Preserve terminal sessions (number of tabs, active tab, running processes) across server restarts, so that AI coding sessions (Claude Code, Codex, Gemini CLI) survive and can be resumed.

---

## Problem

Currently, every WebSocket connection spawns a fresh PTY. When the Node.js server restarts, all PTY processes are killed and all session state is lost. Users lose in-progress AI coding sessions.

---

## Solution Overview

Use **tmux** as the PTY backing layer. Each terminal tab gets a stable UUID (`tid`). The server creates a named tmux session per `tid`. Tmux sessions run independently of the Node server — they survive restarts. The client persists the tab list to `localStorage` so the browser restores the correct tabs on reconnect.

---

## Architecture

### Server

#### New file: `server/modules/terminal/tmux-sessions.ts`

Responsibilities:
- Maintains a `tid → tmux-session-name` map
- Persists map to `~/.v2/sessions.json` (survives server restarts)
- `getOrCreate(tid, cols, rows): "new" | "existing"` — creates tmux session `v2-term-{tid}` if it doesn't exist
- `exists(tid): boolean` — checks if tmux session is still alive (`tmux has-session -t v2-term-{tid}`)
- `remove(tid)` — kills tmux session and removes from persisted map
- On module load: reads `sessions.json` to restore known sessions

#### Modified: `server/modules/terminal/handler.ts`

Changes:
- Parses `?tid=` from the WebSocket upgrade URL
- If no `tid` provided, generates a new UUID and sends `{"type":"session","tid":"..."}` as first WS message to client
- Session spawn logic:
  - New session: `pty.spawn("tmux", ["new-session", "-s", "v2-term-{tid}", "-x", cols, "-y", rows])`
  - Existing session: `pty.spawn("tmux", ["attach-session", "-t", "v2-term-{tid}"])`
- **On WS close: does NOT kill the PTY** — tmux keeps running in background
- On WS error or unexpected disconnect: log, do not kill tmux

### Client

#### Modified: `src/lib/terminal-session.ts`

Changes:
- Passes `?tid={id}` in the WebSocket URL on `connect()`
- Handles first WS message: if JSON `{"type":"session","tid":"..."}` — confirms connection (no action needed since client already has the tid)
- No other changes required

#### Modified: `src/composables/terminal-sessions.ts`

Changes:
- `loadFromStorage()`: called on store init — reads `localStorage["v2-terminal-sessions"]` (JSON array of `{id, title}` + `activeId`) and calls `create()` for each stored session
- `persistToStorage()`: called after every `create()`, `remove()`, and `activeId` change — writes current session list to `localStorage["v2-terminal-sessions"]`
- Storage shape:
  ```json
  {
    "sessions": [{ "id": "uuid1", "title": "Terminal 1" }, ...],
    "activeId": "uuid1"
  }
  ```

---

## Resume Flow

1. User has 3 terminal tabs open — Claude Code running in tab 1, Gemini in tab 2
2. Server process is killed (e.g. for a restart/deploy)
3. tmux sessions `v2-term-{tid1}`, `v2-term-{tid2}`, `v2-term-{tid3}` **keep running**
4. Server restarts, loads `sessions.json`
5. Browser detects WS disconnect → shows "reconnecting..." indicator
6. Browser reconnects → reads `localStorage` → creates tab objects with the same UUIDs
7. Each `TerminalSession` connects via `wss://host/ws?tid={uuid}`
8. Server matches each `tid` to its live tmux session → `attach-session`
9. User sees their active shells, Claude Code and Gemini still running

---

## Error Handling

- **tmux session missing** (e.g. tmux server itself was killed): `exists(tid)` returns false → server falls through to `new-session`, starts fresh shell, updates `sessions.json`
- **tmux not installed**: server startup check — log error and fall back to current direct PTY behavior
- **stale localStorage entries** (tabs from a very old session that tmux no longer has): server creates fresh shell → user gets a new shell rather than an error
- **sessions.json corrupt**: catch parse error on load, start with empty map

---

## Requirements

- `tmux` must be installed on the host machine (`brew install tmux` on Mac)
- `~/.v2/` directory created on first run
- No changes to auth, routing, or other modules

---

## Files Changed

| File | Change |
|------|--------|
| `server/modules/terminal/tmux-sessions.ts` | **New** — tmux session manager + file persistence |
| `server/modules/terminal/handler.ts` | **Modified** — use tmux, parse `?tid`, don't kill on WS close |
| `src/lib/terminal-session.ts` | **Modified** — pass `?tid` in WS URL |
| `src/composables/terminal-sessions.ts` | **Modified** — persist to/restore from localStorage |

---

## Out of Scope

- Scrollback replay (tmux `capture-pane`) — can be added later
- Multiple users / session isolation beyond current auth
- tmux session cleanup UI (manual `tmux kill-session` for now)
