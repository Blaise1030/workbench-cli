# workbench-cli (Go)

Go implementation of workbench-cli server. See `docs/superpowers/plans/2026-05-28-server-go-migration.md` for the migration plan.

## Build

```bash
# Dev (no embedded assets)
go run ./cmd/workbench-cli --http

# Production (embeds dist/public into the binary)
cd .. && npm run build:go

# Install to PATH
cd .. && npm run install:go              # ~/.local/bin
cd .. && npm run install:go:global      # /usr/local/bin (sudo)
```

## Run

Default (prod / main-branch worktrees) on port **4738**; non-default branches use **4739** (`prodPort + 1`).

```bash
# Prod instance (main / default branch worktrees)
./bin/workbench-cli --http -y

# Non-prod instance (feature-branch worktrees) — run alongside prod
./bin/workbench-cli --http -p 4739 -y
```

### Dev with HMR

```bash
npm run dev:go
```

Starts **Go** (API + WebSocket on port 4740) and **Vite** (UI with HMR on port 5173). Open **http://127.0.0.1:5173** — not the Go port. Vite proxies `/api` and `/ws` to Go.

To run Go alone (no HMR, serves `dist/public` if built):

```bash
cd server-go && go run ./cmd/workbench-cli --http -p 4740
```
