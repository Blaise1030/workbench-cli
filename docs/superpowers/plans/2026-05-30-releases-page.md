# Releases Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/releases` page to the Workbench landing site that statically renders GitHub releases from `Blaise1030/workbench-cli` at build time.

**Architecture:** Single new Astro page (`releases.astro`) that fetches the GitHub releases API in its frontmatter during `astro build`, then renders the data as static HTML. No client-side JS. Falls back to an empty state if the fetch fails. Matches the existing raw text-file aesthetic of `index.astro` exactly.

**Tech Stack:** Astro 5 (static output), Tailwind CSS v4, Geist Mono Variable font, Cloudflare adapter.

---

### Task 1: Create `releases.astro` with GitHub API fetch and full page render

**Files:**
- Create: `landing/src/pages/releases.astro`

- [ ] **Step 1: Create the file with frontmatter fetch logic**

Create `landing/src/pages/releases.astro` with this exact content:

```astro
---
interface Release {
  tag_name: string;
  published_at: string;
  body: string | null;
  html_url: string;
}

let releases: Release[] = [];

try {
  const res = await fetch(
    'https://api.github.com/repos/Blaise1030/workbench-cli/releases',
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (res.ok) {
    releases = await res.json();
  }
} catch {
  // build continues with empty releases
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Workbench release history." />
    <title>Workbench — Releases</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div class="min-h-screen px-4">
      <div class="max-w-2xl px-4 py-8 max-sm:py-10">

        <!-- Brand -->
        <div class="font-semibold flex gap-2 items-center mb-4">
          <h1>WORKBENCH</h1>
          <span class="w-2 h-4 bg-foreground animate-blink" aria-hidden="true"></span>
        </div>

        <!-- Back -->
        <div class="text-[hsl(var(--muted-foreground))] mb-4">
          <a href="/">← Back</a>
        </div>

        <div class="text-[hsl(var(--muted-foreground))] my-[14px]">~~~</div>

        <!-- Releases -->
        <div class="font-semibold tracking-[0.04em]">RELEASES:</div>

        {releases.length === 0 ? (
          <div class="text-[hsl(var(--muted-foreground))] pl-[1ch]">No releases yet.</div>
        ) : (
          releases.map((release) => (
            <div>
              <div class="text-[hsl(var(--muted-foreground))] my-[14px]">~~~</div>
              <div>
                <span class="font-semibold tracking-[0.04em]">VERSION:</span>
                <span class="text-[hsl(var(--muted-foreground))]"> {release.tag_name}</span>
                <span class="text-[hsl(var(--muted-foreground))]">{"  "}DATE: {formatDate(release.published_at)}</span>
              </div>
              {release.body && release.body.trim().split('\n').map((line) => (
                <div class="text-[hsl(var(--muted-foreground))] pl-[1ch]">{line}</div>
              ))}
              <div class="text-[hsl(var(--muted-foreground))] pl-[1ch]">
                <span class="text-[hsl(var(--foreground))]"> -</span>{" "}
                <a href={release.html_url} target="_blank" rel="noopener noreferrer">View on GitHub →</a>
              </div>
            </div>
          ))
        )}

        <div class="text-[hsl(var(--muted-foreground))] my-[14px]">~~~</div>

        <!-- Footer -->
        <div class="text-[hsl(var(--muted-foreground))]">~*~ © 2026 WORKBENCH ~*~</div>

      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Verify the dev server builds without errors**

```bash
cd landing && pnpm dev
```

Navigate to `http://localhost:4321/releases` in a browser. Expected: page renders with the same monospace aesthetic as the home page. If GitHub has no releases yet, "No releases yet." is shown. If releases exist, each one shows version, date, body lines, and a GitHub link.

- [ ] **Step 3: Verify static build passes**

```bash
cd landing && pnpm build
```

Expected: build completes with no errors. Check that `dist/releases/index.html` exists and contains the rendered release content (not a blank page).

```bash
ls landing/dist/releases/
```

Expected output: `index.html`

- [ ] **Step 4: Commit**

```bash
git add landing/src/pages/releases.astro
git commit -m "feat(landing): add static releases page from GitHub API"
```
