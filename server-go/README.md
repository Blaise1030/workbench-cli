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

`npm run dev:go` starts the non-prod port (4739) for local development.
