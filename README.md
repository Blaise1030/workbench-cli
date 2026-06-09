# workbench-cli

A self-contained developer workbench — single Go binary, frontend embedded.

## CI/CD workflow

```
Pull Request
    │
    ▼
CI (typecheck + unit tests)
    │
    └─ merge to main
            │
            ▼
    Release Please
    (opens/updates release PR,
     bumps version, updates CHANGELOG)
            │
            └─ release PR merged
                    │
                    ▼
            Release workflow
            ┌──────────────────────────────┐
            │ Build Go binaries (4 platforms)│
            │   linux/amd64                  │
            │   linux/arm64                  │
            │   darwin/amd64                 │
            │   darwin/arm64                 │
            └──────────┬───────────────────┘
                       │
                       ▼
            Upload tarballs to GitHub Release
                       │
                       ▼
            Deploy landing page to Cloudflare
            (install manifest updated with new tag)
```

### Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | PR → `main` | Typecheck + unit tests |
| `release-please.yml` | Push → `main` | Opens release PRs; dispatches `release-go.yml` when a release is cut |
| `release-go.yml` | Via `release-please.yml` or `workflow_dispatch` | Builds Go binaries, uploads to GitHub Release, redeploys Cloudflare landing page |
| `deploy-landing-page.yml` | Push → `main` (landing page paths) | Builds and deploys the Astro landing page to Cloudflare |
| `preview.yml` | PR from `release-please--*` branch | Builds a dev-versioned binary preview for release PRs |

### Release platforms

| Platform | Asset |
|----------|-------|
| `darwin/arm64` | `workbench-cli-macos-aarch64.tar.gz` |
| `darwin/amd64` | `workbench-cli-macos-x86_64.tar.gz` |
| `linux/arm64` | `workbench-cli-linux-aarch64.tar.gz` |
| `linux/amd64` | `workbench-cli-linux-x86_64.tar.gz` |

### Re-running a release manually

If binaries are missing from a GitHub Release (e.g. the pipeline failed mid-run):

```bash
gh workflow run Release --ref main -f tag=v0.4.3
```

This re-builds all four platform binaries, re-uploads them to the existing release, and redeploys the Cloudflare landing page with the updated install manifest.
