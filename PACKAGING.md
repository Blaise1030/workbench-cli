# Packaging (Herdr-style releases)

[Herdr v0.6.2](https://github.com/ogulcancelik/herdr/releases/tag/v0.6.2) ships a **single native binary** (~10 MB per platform). workbench-cli is a **Node + web UI** app, so the closest equivalent is a **self-contained release archive** with a one-command launcher.

## Size targets

| Artifact | Approx. size |
|----------|----------------|
| Herdr binary | ~10 MB |
| workbench-cli `dist/public/` (UI + allowlisted Shiki) | ~4.4 MB |
| workbench-cli `dist/` (UI + server bundle) | ~3.2 MB |
| Runtime native deps only (`better-sqlite3`, `node-pty`, `ws`) | ~76 MB |
| **Release folder** (dist + natives) | **~80 MB** |
| **Release + embedded Node 20** | **~140 MB** |
| `npm install -g` after dep split | ~89 MB (not ~550 MB) |

## Build a release (current machine)

```bash
npm run package:release
# → release/workbench-cli-macos-arm64.tar.gz
# → release/workbench-cli-macos-arm64/workbench-cli
```

Embed Node so users do not install it separately:

```bash
npm run package:release:all
```

Run:

```bash
tar -xzf release/workbench-cli-macos-arm64.tar.gz
cd workbench-cli-macos-arm64
./workbench-cli --help
```

## What changed for smaller installs

- **Runtime `dependencies`** are only native externals: `better-sqlite3`, `node-pty`, `ws`. Everything else is bundled into `dist/cli/index.cjs` or built into `dist/public/`.
- **Static files** resolve via `server/paths.ts` (works from any cwd, release folder, or future standalone binary).

## Go binary (recommended — single file, ~10 MB)

The Go migration (`server-go/`) produces a true single binary with the frontend embedded:

```bash
npm run build:go
# → bin/workbench-cli  (~10 MB, no Node required)
```

Run:

```bash
./bin/workbench-cli --http
# or with HTTPS (requires mkcert):
./bin/workbench-cli
```

### CI releases

On tag `v*`, `.github/workflows/release-go.yml` builds matrix:

| Platform | Binary |
|----------|--------|
| `darwin/arm64` | `workbench-cli-darwin-arm64.tar.gz` |
| `darwin/amd64` | `workbench-cli-darwin-amd64.tar.gz` |
| `linux/arm64` | `workbench-cli-linux-arm64.tar.gz` |
| `linux/amd64` | `workbench-cli-linux-amd64.tar.gz` |

Each tarball contains a single executable. Attach to GitHub Releases with `softprops/action-gh-release`.

## Node tarball (legacy — ~80–140 MB)

> **Status:** The Node packaging path below is superseded by the Go binary above.

## Roadmap: true single binary (~Herdr)

| Approach | Pros | Cons |
|----------|------|------|
| **Release tarball** (implemented) | Reliable; native addons work | Folder or ~90–140 MB archive, not one file |
| **`@yao-pkg/pkg`** | One executable + embedded assets | ~80–100 MB; native addon tuning per OS |
| **Node SEA** | Official Node feature | Native modules still need `.node` beside binary |
| **Docker** | Predictable CI | Not a desktop binary; image ~150 MB+ |

Recommended next step for a **single file**: add `pkg` (or `bun build --compile` when native deps are supported) in CI, targeting `node20-macos-arm64`, `node20-linux-x64`, etc., with `dist/public` as assets.

## GitHub Releases (CI sketch)

On tag `v*`:

1. `npm ci && npm run build`
2. Matrix: macOS arm64/x64, Linux x64/arm64
3. `npm run package:release:all` per runner
4. Upload `release/*.tar.gz` as release assets (same layout as Herdr’s `herdr-macos-aarch64`, etc.)
