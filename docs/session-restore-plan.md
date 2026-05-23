# Session Restore — Integration Plan

Adapts [cmux's session-restore model](https://cmux.com/docs/session-restore) to lan-terminal's server-side architecture.

## Current state

- `server/modules/terminal/handler.ts` — PTY is spawned on first WS `resize` and killed on `ws.close`. No persistence across disconnect.
- `server/modules/workspace/terminals.ts` — Terminal *metadata* (id, title, worktreeId, sortOrder) persists in SQLite via drizzle.
- `src/composables/terminal-sessions.ts` — Client-side session registry (per-tab `TerminalSession` keyed by id).
- Already have OSC 133 shell integration (`shell-integration.ts`) — useful for agent hook capture later.

## What cmux does that we want

1. Layout snapshot (windows/panes/cwd) — partially done via SQLite rows.
2. Bounded scrollback persisted, replayed on restore.
3. Agent hooks capture native session id, replay `claude --resume <id>` / `codex resume <id>` / etc.
4. Generic per-surface `resumeCommand` with trust-prompted auto-run.

## Slice 0 — Settings module foundation (prerequisite)

`server/modules/settings/` today only handles LAN config via an in-memory `LanManager` — there is no general-purpose persisted settings store. The hooks/resume UI from cmux (Settings > Terminal > Resume Agent Sessions, Settings > Terminal > Resume Commands) needs one. Build it once, reuse across slices.

**Schema** (new drizzle table):
```ts
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),       // e.g. "terminal.autoResumeAgentSessions"
  value: text("value").notNull(),       // JSON-encoded
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
```

**Module shape** — add `server/modules/settings/store.ts`:
```ts
export interface SettingsStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(prefix?: string): Promise<Record<string, unknown>>;
}
```
Backed by the new `settings` table. Cache hot keys in memory.

**Router** — extend `server/modules/settings/router.ts`:
```
GET    /api/settings/terminal              → { autoResumeAgentSessions, ptyIdleTtlHours, scrollbackCapKb }
PATCH  /api/settings/terminal              → partial update
GET    /api/settings/terminal/resume-commands       → ApprovedPrefix[]
POST   /api/settings/terminal/resume-commands       → create/approve
DELETE /api/settings/terminal/resume-commands/:id   → revoke
```

**Keys introduced by this plan** (defaults match cmux behavior):

| Key | Default | Owner slice |
|---|---|---|
| `terminal.autoResumeAgentSessions` | `true` | D |
| `terminal.ptyIdleTtlHours` | `24` | A |
| `terminal.scrollbackCapKb` | `4096` | A / B |
| `terminal.scrollbackPersistOnShutdown` | `true` | B |
| `terminal.resumeCommands.approvedPrefixes` | `[]` | C |
| `terminal.agentHooks.<agent>.enabled` | `true` per supported agent | D |

**UI** — extend `src/components/Settings.vue` with a new `TerminalSettingsCard.vue` section mirroring cmux's "Terminal" panel: a toggle group for autoresume + scrollback knobs, and a sub-table of approved resume commands (view / revoke / inspect cwd+env).

**Files touched:** `db/schema.ts` + migration, new `server/modules/settings/store.ts`, `server/modules/settings/router.ts` (extend), new `src/components/TerminalSettingsCard.vue`, `src/api/settings.ts` (new query/mutation hooks).

Slices A–D below should read all tunables through `SettingsStore` rather than constants, so the toggles are wired from day one.

## Slice A — Persistent PTY across WS reconnect (biggest UX win)

**Goal:** closing/refreshing the browser tab does not kill running commands.

- New `server/modules/terminal/pty-registry.ts`:
  ```ts
  // Map<terminalId, { pty: IPty, ring: RingBuffer, clients: Set<WebSocket>, idleSince?: number }>
  ```
- Refactor `handler.ts`:
  - On connect: `registry.attach(terminalId, ws)`. If no PTY exists, spawn one with stored cwd. If one exists, send `ring.snapshot()` immediately.
  - On `pty.onData`: append to ring buffer, fan out to all attached clients.
  - On `ws.close`: detach client. **Do not kill PTY.** Optionally start TTL timer (e.g. 24 h idle) to reclaim.
- Add explicit `DELETE /api/terminals/:id` route that calls `registry.kill(id)` and removes the row.
- Ring buffer: 4 MB cap, bytes-based, simple `Buffer[]` with eviction (cmux uses bounded text).

**Files touched:** `handler.ts`, new `pty-registry.ts`, `terminals.ts` (delete hook), `terminals/router.ts`.

## Slice B — Scrollback survives server restart

Cmux's "best-effort scrollback replay" pattern, used only when the live process is gone.

- On SIGTERM / `process.on('beforeExit')`, dump each ring to `<dataDir>/scrollback/<terminalId>.bin` (+ `.meta.json` with cwd, last activity, exit code).
- On spawn for a terminalId with a dump file: `ws.send(dump)` once, delete the file, then start a fresh PTY in the saved cwd.
- Mirror cmux's "previous-session cache" by keeping the latest dump under `scrollback/previous/` for manual reopen.

**Files touched:** `pty-registry.ts`, `server/db/data-dir.ts` (paths), `server/index.ts` (shutdown hook).

## Slice C — Per-terminal custom resume command

Cmux's "surface resume" mechanic. Lets advanced users say "this terminal always restarts as `tmux attach -t work`".

- Schema: add `resumeCommand TEXT NULL`, `resumeTrusted INTEGER NOT NULL DEFAULT 0` to `terminals` table (drizzle migration).
- If `resumeCommand` is set and `resumeTrusted = 1`, spawn it (via shell `-c`) instead of plain `$SHELL` on cold start.
- UI affordance in terminal tab context menu: "Set restart command…" → modal that explains the trust trade-off, stores `resumeCommand` and asks for trust confirmation (matches cmux's "approved prefix" Settings page).
- Sanitization: strip env keys matching `/token|secret|password|api_key/i` from any captured env (cmux does this).

**Files touched:** `db/schema.ts` + migration, `terminals.ts` router (PATCH fields), `pty-registry.ts` (spawn branch), new `src/components/TerminalResumeDialog.vue`.

## Slice D — Agent session resume (optional, larger)

Patterned on cmux `hooks setup`. Defer until A–C ship.

- Adapter per agent (`claude`, `codex`, `grok`, …). Each knows: binary name, where it stores session JSONL, and resume verb.
- Detection: when shell integration reports a command exit (OSC 133;C), check if the command line matched an adapter binary; if so, walk the agent's session dir for the newest session id, store on the terminal row (`agentKind`, `agentSessionId`).
- On respawn with `agentSessionId`, run `<binary> <resume-verb> <id>` instead of bare shell, behind a `terminal.autoResumeAgentSessions` setting (matches cmux toggle).
- Storage: extend `terminals` table or new `terminal_agent_sessions` table.

**Files touched:** new `server/modules/agents/` dir, `shell-integration.ts` (emit a structured event channel, not just OSC), `terminals.ts`.

## Order & sizing

| Slice | Effort | User value | Depends on |
|---|---|---|---|
| 0 — settings store | S (½ day) | Foundation for tunables/toggles | — |
| A — persistent PTY | M (1 day) | Huge: no lost work on refresh | 0 |
| B — scrollback dump | S (½ day) | Medium: survives server restart | 0, A |
| C — custom resume cmd | S (½ day) | Niche power-user | 0, A |
| D — agent resume | L (multi-day) | High if you use agents | 0, A |

Ship 0 + A together first — that's a single coherent "your terminals survive a refresh" release, with settings already wired so later slices just add keys.

## Notes / divergences from cmux

- Cmux is a desktop app, so it dumps to `~/Library/Application Support/cmux/…`. We use the existing `data-dir.ts` location.
- Cmux *cannot* keep PTYs alive (Electron app restart). We can — Slice A is strictly better than cmux's "scrollback replay" for the live case.
- Cmux's "browser URL/history restore" doesn't apply (we are the browser content).
- Skip cmux's signed-prefix cryptography for v1 — a per-terminal "trusted" boolean gated by an explicit UI confirmation is enough.
