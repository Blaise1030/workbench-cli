# workbench-cli (Go)

Go implementation of workbench-cli server. See `docs/superpowers/plans/2026-05-28-server-go-migration.md` for the migration plan.

## Build

```bash
# Dev (no embedded assets)
go run ./cmd/workbench-cli --http

# Production (embeds dist/public)
cd .. && npm run build:go
```

## Run

```bash
./bin/workbench-cli --http -p 4739 -y
```
