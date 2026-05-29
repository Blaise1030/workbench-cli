# server-go Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the **Hono** server (`server/`) with a single Go `workbench-cli` binary (embedded UI, full API parity) using a strangler migration.

**Architecture:** New `server-go/` tree. Every feature is ported from the **Hono implementation** in `server/` — routers, modules, schemas, and Vitest tests. Contract tests spawn `tsx server/index.ts` and assert Go responses match Hono JSON. (`server-rs/` was removed; Hono is the only reference.)

**Tech Stack:** Go 1.22+, chi, coder/websocket, creack/pty, modernc.org/sqlite, go:embed, slog.

**Design spec:** `docs/superpowers/specs/2026-05-28-hono-go-migration-design.md`

**Hard constraint:** Do **not** modify `server/`. **Port source = Hono only** (`server/`, `cli/args.ts`, `server/schemas/`). Implement exclusively in `server-go/` (+ root `scripts/`, `package.json` as needed).

---

## Phase 0 — Scaffold, health, static SPA

### Task 0.1: Module skeleton

**Files:**
- Create: `server-go/go.mod`
- Create: `server-go/README.md`
- Create: `server-go/cmd/workbench-cli/main.go`

- [ ] **Step 1:** Create `server-go/go.mod`:

```bash
cd server-go
go mod init github.com/blaisetiong/workbench-cli/server-go
go get github.com/go-chi/chi/v5@v5.2.1
go get github.com/spf13/cobra@v1.9.1
```

- [ ] **Step 2:** Create `server-go/cmd/workbench-cli/main.go`:

```go
package main

import (
	"log/slog"
	"os"

	"github.com/blaisetiong/workbench-cli/server-go/internal/cli"
)

func main() {
	if err := cli.Execute(os.Args[1:]); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}
```

- [ ] **Step 3:** Run `cd server-go && go build ./cmd/workbench-cli` — expect compiles after Task 0.2.

- [ ] **Step 4:** Commit: `feat(server-go): add module skeleton`

### Task 0.2: CLI flags (parity `cli/args.ts`)

**Files:**
- Create: `server-go/internal/cli/cli.go`
- Create: `server-go/internal/cli/flags.go`
- Create: `server-go/internal/config/network.go` (read `~/.workbench/config.json` — port from `server/modules/settings/network-config.ts`)

- [ ] **Step 1:** Implement `ParseArgs(argv []string) (Config, error)` with flags: `--port/-p`, `--host`, `--http/--insecure`, `--yes/-y`, `--help/-h`; defaults from env `PORT`, `WORKBENCH_HOST` then file config.

- [ ] **Step 2:** Help text must match `cli/args.ts` wording (host default `workbench.local`, port from config).

- [ ] **Step 3:** `cli.Execute` calls `server.Run(cfg)` when not help.

- [ ] **Step 4:** Commit: `feat(server-go): CLI flags matching Node cli`

### Task 0.3: HTTP server + health

**Files:**
- Create: `server-go/internal/server/server.go`
- Create: `server-go/internal/api/router.go`
- Create: `server-go/internal/api/health.go`
- Create: `server-go/internal/appstate/state.go`

- [ ] **Step 1:** Health handler:

```go
// internal/api/health.go
package api

import (
	"encoding/json"
	"net/http"
)

type healthResponse struct {
	OK      bool   `json:"ok"`
	Server  string `json:"server"`
	Version string `json:"version"`
}

func Health(version string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(healthResponse{
			OK: true, Server: "go", Version: version,
		})
	}
}
```

- [ ] **Step 2:** Chi router: `r.Route("/api", func(r chi.Router) { r.Get("/health", Health(version)) })`.

- [ ] **Step 3:** `server.Run` listens on `cfg.Host:cfg.Port`, SIGINT/SIGTERM graceful shutdown (5s timeout).

- [ ] **Step 4:** Manual test:

```bash
cd server-go && go run ./cmd/workbench-cli --http -p 4739 -y
curl -s http://127.0.0.1:4739/api/health
```

Expected: `{"ok":true,"server":"go","version":"..."}`

- [ ] **Step 5:** Commit: `feat(server-go): HTTP server and /api/health`

### Task 0.4: Static assets (embed + dev fallback)

**Files:**
- Create: `server-go/internal/assets/assets.go`
- Create: `server-go/internal/assets/embed_prod.go` (`//go:build embed`)
- Create: `server-go/internal/assets/embed_dev.go` (`//go:build !embed`)

- [ ] **Step 1:** Prod build tag embeds `dist/public`:

```go
//go:build embed
package assets

import "embed"

//go:embed all:../../../dist/public
var Public embed.FS
```

- [ ] **Step 2:** Dev build serves `os.DirFS("../dist/public")` when directory exists; else 404 with hint to run `npm run build`.

- [ ] **Step 3:** SPA fallback: if path not found and not `/api/*`, serve `/index.html`.

- [ ] **Step 4:** Commit: `feat(server-go): embedded and dev static file serving`

### Task 0.5: Root npm scripts + smoke test

**Files:**
- Modify: `package.json` (add scripts)
- Create: `scripts/test-go-smoke.mjs`

- [ ] **Step 1:** Add scripts:

```json
"build:go": "npm run build && cd server-go && go build -tags embed -ldflags='-s -w' -o ../bin/workbench-cli ./cmd/workbench-cli",
"dev:go": "cd server-go && go run ./cmd/workbench-cli --http",
"test:go:smoke": "node scripts/test-go-smoke.mjs"
```

- [ ] **Step 2:** Smoke script: spawn Go binary on port 4742, poll `/api/health` until 200, `GET /` returns HTML, exit 0.

- [ ] **Step 3:** Run `npm run test:go:smoke` — expect PASS.

- [ ] **Step 4:** Commit: `chore: add build:go and smoke test`

**Phase 0 done when:** `./bin/workbench-cli --http` serves UI + health without Node.

---

## Phase 1 — Auth

**Hono reference:** `server/modules/auth/*`, `server/modules/auth/router.ts`  
**Tests to mirror:** `session.test.ts`, `token.test.ts`, `invite.test.ts`

**Files to create:** `internal/auth/{token,session,local,invite,middleware,router}.go`

- [ ] **Step 1:** Port `token.ts` → issue/validate session tokens (same cookie name, same header rules).
- [ ] **Step 2:** Port `session.ts` → in-memory session map + expiry.
- [ ] **Step 3:** Routes: `POST /api/auth/local`, `POST /api/auth/` (body schema from `server/schemas/api.ts`).
- [ ] **Step 4:** Middleware `RequireSession` — mirror `requireSession` in `middleware.ts`; apply to all workspace routes later.
- [ ] **Step 5:** Tests: `go test ./internal/auth/...` port cases from `session.test.ts`, `token.test.ts`, `invite.test.ts`.
- [ ] **Step 6:** Contract test: auth endpoints vs Node (see Phase 0.6 below).
- [ ] **Step 7:** Commit: `feat(server-go): auth phase 1`

---

## Phase 2 — Settings + keybindings

**Hono reference:** `server/modules/settings/*`, `server/modules/keybindings/*`  
**Tests to mirror:** `store.test.ts`, `lan.test.ts`, `terminal-settings.test.ts`, `keybindings/store.test.ts`

- [ ] **Step 1:** `SettingsStore` — JSON file or DB keys matching `store.ts`.
- [ ] **Step 2:** Routes: `/api/settings/lan`, `/network`, `/terminal`, `/terminal/resume-commands` (all methods from `settings/router.ts`).
- [ ] **Step 3:** Keybindings: `GET/PUT /api/keybindings/`.
- [ ] **Step 4:** Tests from `store.test.ts`, `lan.test.ts`, `terminal-settings.test.ts`, `keybindings/store.test.ts`.
- [ ] **Step 5:** Commit: `feat(server-go): settings and keybindings`

---

## Phase 3 — Workspace (no PTY attach yet)

**Hono reference:** `server/modules/workspace/*`, `server/schemas/workspace.ts`  
**Tests to mirror:** `projects.test.ts`, `files.test.ts`, `drop-assets.test.ts`, etc.

- [ ] **Step 1:** DB layer — `internal/db/migrate.go` runs same SQL as `server/db/migrate.ts`; open `~/.workbench/data.db` via `data-dir.ts` logic.
- [ ] **Step 2:** Projects: list, register, delete, pick-folder, branches.
- [ ] **Step 3:** Worktrees: CRUD, file list, read/write content, drop-assets.
- [ ] **Step 4:** Path guard — port `path-guard.ts` (no directory escape).
- [ ] **Step 5:** Terminals REST stubs return DB rows only (no live PTY until Phase 5).
- [ ] **Step 6:** Contract tests for each route group.
- [ ] **Step 7:** Commit: `feat(server-go): workspace phase 3`

---

## Phase 4 — Git panel

**Hono reference:** `server/modules/git/*`  
**Tests to mirror:** `status` snapshots, `actions.test.ts`, `commit.test.ts`, `diff.test.ts`, `worktree-list.test.ts`

- [ ] **Step 1:** `internal/git/exec.go` — subprocess wrapper mirroring `git/exec.ts`.
- [ ] **Step 2:** status, diff, actions, commit endpoints under `/api/worktrees/:id/git/*`.
- [ ] **Step 3:** Port tests: `status` snapshot tests, `actions.test.ts`, `commit.test.ts`, `diff.test.ts`.
- [ ] **Step 4:** Commit: `feat(server-go): git panel`

---

## Phase 5 — Terminals + WebSocket (highest risk)

**Hono reference (read in this order):**

1. `docs/terminal-architecture.md` — system overview  
2. `server/index.ts` — `attachWebSocketUpgrade`, `createPtyRegistry`, shutdown  
3. `server/modules/terminal/handler.ts` — WS message types, upgrade auth  
4. `server/modules/terminal/pty-registry.ts` — attach/detach, fan-out, idle timer  
5. `server/modules/terminal/{pty,ring-buffer,osc-parser,scrollback-persist,shell-integration,sanitize-env}.ts`

**Tests to mirror:** `pty.test.ts`, `pty-registry` behaviors via integration, `ring-buffer.test.ts`, `osc-parser.test.ts`, `scrollback-persist.test.ts`, `shell-integration.test.ts`, `sanitize-env.test.ts`

- [ ] **Step 1:** `RingBuffer` — port `server/modules/terminal/ring-buffer.ts` + `ring-buffer.test.ts`.
- [ ] **Step 2:** `OscParser` — port `server/modules/terminal/osc-parser.ts` + `osc-parser.test.ts`.
- [ ] **Step 3:** `PtyRegistry` — match Hono `pty-registry.ts` behavior; Go concurrency:
  - `map[terminalID]*ptyEntry` with `sync.RWMutex` for metadata only
  - per-PTY: `readLoop()` goroutine → `chan []byte` → fan-out to client send channels
  - **never** lock registry during PTY read (avoid Hono-style executor stall under load)
- [ ] **Step 4:** REST: create/list/patch/delete — `server/modules/workspace/terminals.ts` + workspace router routes.
- [ ] **Step 5:** WebSocket `/ws` — `coder/websocket`; message protocol from `handler.ts` (compare wire format to Hono `ws` handlers).
- [ ] **Step 6:** Scrollback persist — port `scrollback-persist.ts`; shell integration — port `shell-integration.ts`.
- [ ] **Step 7:** Idle TTL, resize, sanitize-env — port tests.
- [ ] **Step 8:** Manual test checklist: attach, resize, detach, reattach, scrollback replay, agent resume argv.
- [ ] **Step 9:** Commit: `feat(server-go): PTY and WebSocket`

---

## Phase 6 — Agents, TLS, LAN

**Hono reference:** `server/modules/agents/*`, `server/transport.ts`, `server/tls.ts`, `server/modules/settings/lan.ts`  
**Tests to mirror:** `adapters.test.ts`, `match.test.ts`, `session-utils.test.ts`, `transport.test.ts`, `tls.test.ts`, `lan.test.ts`

- [ ] **Step 1:** Agent command-complete hook — `handle-command.ts`.
- [ ] **Step 2:** TLS via mkcert — port cert loading; `--http` skips TLS.
- [ ] **Step 3:** LAN toggle callbacks — `LanManager` parity with `lan.ts`.
- [ ] **Step 4:** Commit: `feat(server-go): agents and LAN TLS`

---

## Phase 7 — Release CI

**Files:**
- Create: `.github/workflows/release-go.yml` (or extend existing)
- Modify: `PACKAGING.md`

- [ ] **Step 1:** Matrix build: `GOOS=darwin,linux` × `GOARCH=arm64,amd64`, `-tags embed`, strip ldflags.
- [ ] **Step 2:** Attach tarballs to GitHub Releases on `v*` tags.
- [ ] **Step 3:** Update `PACKAGING.md` — Go binary replaces pkg/Node roadmap.
- [ ] **Step 4:** Commit: `ci: release workbench-cli Go binaries`

---

## Cross-cutting: Contract tests (start after Phase 1)

### Task C.1: contract-test runner

**Files:**
- Create: `scripts/contract-test.mjs`
- Create: `server-go/test/contract/fixtures/*.json`

- [ ] **Step 1:** Script spawns **Hono** (`tsx server/index.ts`) on 4740 and Go on 4741 with same seed DB / temp data dir.

- [ ] **Step 2:** For each fixture: method, path, headers, body → assert response status + JSON deep-equal (ignore volatile fields if documented).

- [ ] **Step 3:** Add `npm run test:contract` to root `package.json`.

- [ ] **Step 4:** Commit: `test: add Node vs Go contract harness`

### Task C.2: Benchmark (extend existing plan)

**Files:**
- Modify: `scripts/benchmark.mjs` (from `docs/superpowers/plans/2026-05-27-benchmark.md`)

- [ ] **Step 1:** Add Go column: spawn `bin/workbench-cli --http -p 4743`.
- [ ] **Step 2:** Write `bench-results.json` with `typescript` + `go` keys.
- [ ] **Step 3:** Commit: `chore: benchmark TypeScript vs Go`

---

## Module mapping cheat sheet (Hono → Go)

| Go package | Hono reference (`server/`) |
|------------|----------------------------|
| `internal/cli` | `cli/args.ts` + `server/modules/settings/network-config.ts` |
| `internal/server` | `server/index.ts` (listen, upgrade, shutdown) |
| `internal/api` | `server/api/index.ts` |
| `internal/auth` | `server/modules/auth/` |
| `internal/settings` | `server/modules/settings/` |
| `internal/keybindings` | `server/modules/keybindings/` |
| `internal/workspace` | `server/modules/workspace/` |
| `internal/git` | `server/modules/git/` |
| `internal/terminal` | `server/modules/terminal/` |
| `internal/agents` | `server/modules/agents/` |
| `internal/db` | `server/db/` (`schema.ts`, `migrate.ts`, `data-dir.ts`) |
| `internal/assets` | `server/paths.ts`, `server/app.ts` (`serveStatic`) |

---

## Cutover checklist (final PR)

- [ ] All contract tests pass
- [ ] `npm run test:go:smoke` in CI
- [ ] Hono Vitest `server/**` still green (run as-is; **no edits** to `server/`)
- [ ] `git diff server/` is empty across migration branch
- [ ] `package.json` default start uses Go binary
- [ ] `server-go/README.md` documents build/run

---

## Execution handoff

**Plan saved to** `docs/superpowers/plans/2026-05-28-server-go-migration.md`  
**Spec saved to** `docs/superpowers/specs/2026-05-28-hono-go-migration-design.md`

**Two execution options:**

1. **Subagent-driven (recommended)** — one fresh agent per phase/task, review between tasks  
2. **Inline** — implement Phase 0 in this session, checkpoint before Phase 1

Which approach do you want?
