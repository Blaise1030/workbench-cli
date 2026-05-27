# workbench-cli (Rust server)

Parallel native server for workbench-cli. The existing Hono app in `../server/` is **not modified** by this crate.

## Prerequisites

- [Rust](https://rustup.rs/) 1.75+
- For embedded UI builds: `npm run build` (produces `../dist/public/`)

## Development

```bash
# From repo root — build the Vue UI first
npm run build

# Run Rust server (serves ../dist/public from disk)
cd server-rs && cargo run -- --http

# Open http://127.0.0.1:4738
```

## Release binary (single file, UI embedded)

```bash
npm run build:rust
# → server-rs/target/release/workbench-cli (~10–15 MB)
```

Or manually:

```bash
npm run build
cd server-rs
cargo build --release --features embed-assets
```

Smoke test (builds + runs API/UI checks):

```bash
npm run test:rust:smoke
```

Run anywhere — no Node, no `dist/` folder:

```bash
./target/release/workbench-cli
```

## CLI flags

Matches the Node CLI (`cli/args.ts`):

| Flag | Description |
|------|-------------|
| `-p, --port` | Port (default 4738) |
| `--host` | Hostname (default `workbench.local`) |
| `--http, --insecure` | HTTP only (no TLS) |
| `-y, --yes` | Auto-confirm mkcert install (Phase 6) |
| `-h, --help` | Help |

## Migration status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | CLI, health, static SPA | **In progress** |
| 1 | Auth | Planned |
| 2 | Settings, keybindings | Planned |
| 3–7 | Workspace, git, PTY, agents, CI | Planned |

See `docs/superpowers/specs/2026-05-27-hono-rust-migration-design.md`.
