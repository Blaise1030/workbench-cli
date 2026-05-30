# Releases Page Design

**Date:** 2026-05-30
**Status:** Approved

## Overview

Add a `/releases` page to the Workbench landing site that displays GitHub releases from `Blaise1030/workbench-cli`, fetched statically at build time.

## Architecture

- **New file:** `landing/src/pages/releases.astro`
- **Data source:** GitHub API — `https://api.github.com/repos/Blaise1030/workbench-cli/releases`
- **Fetch timing:** Astro frontmatter at `astro build` (build-time only, zero client JS)
- **Fallback:** Empty array with "No releases yet." message if fetch fails

## Data extracted per release

| Field | Source | Format |
|---|---|---|
| Version | `tag_name` | as-is (e.g. `v0.1.0`) |
| Date | `published_at` | `YYYY-MM-DD` |
| Notes | `body` | plain text, rendered as-is |
| Link | `html_url` | "View on GitHub →" anchor |

## Page Layout

Matches existing `index.astro` aesthetic exactly — Geist Mono, uppercase labels, `~~~` separators, `--muted-foreground` text, `--foreground` for labels.

```
WORKBENCH [blink cursor]

← Back

RELEASES:
~~~
VERSION: v0.2.0                    DATE: 2026-05-15
  <release body lines>
  - [View on GitHub →]
~~~
VERSION: v0.1.0                    DATE: 2026-04-01
  <release body lines>
  - [View on GitHub →]
~~~
~*~ © 2026 WORKBENCH ~*~
```

## Constraints

- No new CSS — reuse all existing CSS variables from `global.css`
- No client-side JS
- Static output compatible with Cloudflare adapter
- `output: 'static'` in `astro.config.mjs` — fetch must be in frontmatter only
