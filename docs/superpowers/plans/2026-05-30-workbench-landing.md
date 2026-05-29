# Workbench Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static landing page for Workbench in `landing/` using Astro + Cloudflare Pages with a raw text-file aesthetic (code.storage / pierre.computer style), Geist fonts, and shadcn CSS variable theming.

**Architecture:** Single Astro static site in a `landing/` subdirectory at the project root. No framework islands — pure HTML + CSS output. Cloudflare Pages adapter for deployment. Styles use shadcn CSS variable tokens with `prefers-color-scheme` for light/dark.

**Tech Stack:** Astro 5, `@astrojs/cloudflare` (static), Tailwind CSS v4, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`

---

## File Map

| File | Purpose |
|------|---------|
| `landing/package.json` | Dependencies and scripts |
| `landing/astro.config.mjs` | Astro config with Cloudflare static adapter |
| `landing/tailwind.config.mjs` | Tailwind config pointing at src files |
| `landing/tsconfig.json` | TypeScript config for Astro |
| `landing/src/styles/global.css` | shadcn CSS vars, Geist font-face imports, base styles |
| `landing/src/pages/index.astro` | The entire landing page |
| `landing/public/favicon.svg` | Minimal favicon |
| `landing/wrangler.toml` | Cloudflare Pages deployment config |

---

### Task 1: Scaffold the Astro project

**Files:**
- Create: `landing/package.json`
- Create: `landing/tsconfig.json`
- Create: `landing/astro.config.mjs`

- [ ] **Step 1: Create `landing/` directory**

```bash
mkdir -p landing/src/pages landing/src/styles landing/public
```

- [ ] **Step 2: Create `landing/package.json`**

```json
{
  "name": "workbench-landing",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.0.0",
    "@fontsource-variable/geist": "^5.2.9",
    "@fontsource-variable/geist-mono": "^5.2.8",
    "astro": "^5.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "tailwindcss": "^4.3.0"
  }
}
```

- [ ] **Step 3: Create `landing/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 4: Create `landing/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 5: Install dependencies**

```bash
cd landing && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add landing/package.json landing/package-lock.json landing/tsconfig.json landing/astro.config.mjs
git commit -m "feat(landing): scaffold Astro + Cloudflare static project"
```

---

### Task 2: Global styles — shadcn tokens + Geist fonts

**Files:**
- Create: `landing/src/styles/global.css`

- [ ] **Step 1: Create `landing/src/styles/global.css`**

```css
/* Geist font-face (latin subset only) */
@font-face {
  font-family: "Geist Variable";
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url("@fontsource-variable/geist/files/geist-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
    U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
    U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Geist Mono Variable";
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url("@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
    U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
    U+FEFF, U+FFFD;
}

@import "tailwindcss";

/* shadcn CSS variable tokens — light mode */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --link: 263 70% 60%;
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --muted-foreground: 240 5% 64.9%;
    --border: 240 3.7% 15.9%;
    --link: 263 70% 72%;
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

body {
  font-family: "Geist Mono Variable", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
}

a {
  color: hsl(var(--link));
  text-decoration: underline;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

- [ ] **Step 2: Verify build still passes**

```bash
cd landing && npm run build
```

Expected: Build completes (will warn about missing index.astro — that's fine for now).

- [ ] **Step 3: Commit**

```bash
git add landing/src/styles/global.css
git commit -m "feat(landing): add global styles with shadcn tokens and Geist fonts"
```

---

### Task 3: Minimal favicon

**Files:**
- Create: `landing/public/favicon.svg`

- [ ] **Step 1: Create `landing/public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0a0a0a"/>
  <text x="6" y="23" font-family="monospace" font-size="18" fill="white">W</text>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add landing/public/favicon.svg
git commit -m "feat(landing): add favicon"
```

---

### Task 4: Landing page — index.astro

**Files:**
- Create: `landing/src/pages/index.astro`

- [ ] **Step 1: Create `landing/src/pages/index.astro`**

```astro
---
import '../styles/global.css';

const installCmd = 'curl -fsSL https://blaise1030.github.io/workbench-cli/install.sh | sh';
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Mission control for parallel AI coding. Workbench is a GUI workspace manager for engineers running multiple Claude Code agents in parallel across git worktrees." />
    <title>Workbench</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div class="content">

      <div class="brand">WORKBENCH <span class="cursor" aria-hidden="true"></span></div>

      <div class="divider">~~~</div>

      <div class="row"><span class="label">PRODUCT:</span> <span class="muted">GUI WORKSPACE MANAGER FOR AI-DRIVEN DEVELOPMENT</span></div>
      <div class="row"><span class="label">STATUS:</span> <span class="muted">AVAILABLE</span></div>
      <div class="row"><span class="label">VERSION:</span> <span class="muted">0.1.0</span></div>
      <div class="row"><span class="label">PLATFORM:</span> <span class="muted">MACOS</span></div>

      <div class="divider">~~~</div>

      <div class="row"><span class="label">ABOUT:</span></div>
      <p class="prose">
        Mission control for parallel AI coding. Workbench is a single GUI for every git worktree,
        every Claude Code agent, and every running branch — all at once. No more juggling terminal
        windows. No more losing track of which agent is working on what.
      </p>
      <p class="prose">
        Built for engineers running Claude Code at scale. Keep your editor; add one place to see everything.
      </p>

      <div class="divider">~~~</div>

      <div class="row"><span class="label">INSTALL:</span></div>
      <div class="install-row">
        <span class="install-cmd" id="install-cmd">{installCmd}</span>
        <button class="copy-btn" onclick="copyInstall()" aria-label="Copy install command">COPY</button>
      </div>
      <div class="list-item"><span class="dash"> -</span> <a href="https://blaise1030.github.io/workbench-cli/">Install options</a></div>
      <div class="list-item"><span class="dash"> -</span> <a href="https://github.com/Blaise1030/workbench-cli/releases">Releases</a></div>

      <div class="divider">~~~</div>

      <div class="row"><span class="label">FEATURES:</span></div>
      <div class="list-item"><span class="dash"> -</span> Parallel git worktrees, tracked in one sidebar</div>
      <div class="list-item"><span class="dash"> -</span> Claude Code hook integration — get notified when agents stop or complete tasks</div>
      <div class="list-item"><span class="dash"> -</span> Per-worktree terminal tabs, git panel, and file explorer</div>
      <div class="list-item"><span class="dash"> -</span> Line-level diffs, staged/unstaged review without leaving the app</div>
      <div class="list-item"><span class="dash"> -</span> Keybinding configuration and LAN network settings</div>
      <div class="list-item"><span class="dash"> -</span> Single binary — no Electron, no runtime dependencies</div>

      <div class="divider">~~~</div>

      <div class="row"><span class="label">HOW IT COMPARES:</span></div>
      <div class="list-item"><span class="dash"> -</span> Tower / GitHub Desktop: git GUIs, no worktree-first workflow, no agent awareness</div>
      <div class="list-item"><span class="dash"> -</span> herdr: lives inside your terminal, not a GUI</div>
      <div class="list-item"><span class="dash"> -</span> Cursor / VS Code: editors that run one agent at a time</div>
      <div class="list-item"><span class="dash"> -</span> Workbench: the only GUI built for parallel agents + git worktrees together</div>

      <div class="divider">~~~</div>

      <div class="row"><span class="label">LINKS:</span></div>
      <div class="list-item"><span class="dash"> -</span> <a href="/docs">Docs</a></div>
      <div class="list-item"><span class="dash"> -</span> <a href="https://github.com/Blaise1030/workbench-cli">Source</a></div>
      <div class="list-item"><span class="dash"> -</span> <a href="https://github.com/Blaise1030/workbench-cli/releases">Releases</a></div>
      <div class="list-item"><span class="dash"> -</span> <a href="/changelog">Changelog</a></div>

      <div class="divider">~~~</div>

      <div class="muted">~*~ &copy; 2026 WORKBENCH ~*~</div>

    </div><!-- .content -->

    <style>
      .content {
        padding: 32px 48px;
        max-width: 680px;
      }

      .brand {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.08em;
        margin-bottom: 16px;
      }

      .cursor {
        display: inline-block;
        width: 9px;
        height: 1em;
        background: hsl(var(--foreground));
        vertical-align: text-bottom;
        margin-left: 3px;
        animation: blink 1.1s step-end infinite;
      }

      .divider {
        color: hsl(var(--muted-foreground));
        margin: 14px 0;
      }

      .row {
        margin-bottom: 0;
      }

      .label {
        font-weight: 600;
        letter-spacing: 0.04em;
      }

      .muted {
        color: hsl(var(--muted-foreground));
      }

      .prose {
        color: hsl(var(--muted-foreground));
        max-width: 580px;
        padding-left: 1ch;
      }

      .list-item {
        color: hsl(var(--muted-foreground));
      }

      .list-item .dash {
        color: hsl(var(--foreground));
      }

      .install-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-left: 1ch;
        margin-bottom: 4px;
      }

      .install-cmd {
        color: hsl(var(--foreground));
        font-weight: 500;
        font-size: 12px;
      }

      .copy-btn {
        font-family: "Geist Mono Variable", monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
        background: hsl(var(--foreground));
        color: hsl(var(--background));
        border: none;
        padding: 2px 8px;
        cursor: pointer;
        border-radius: 2px;
        flex-shrink: 0;
      }

      .copy-btn:hover {
        opacity: 0.8;
      }

      @media (max-width: 600px) {
        .content {
          padding: 24px 20px;
        }
        .install-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }
        .install-cmd {
          font-size: 11px;
          word-break: break-all;
        }
      }
    </style>

    <script>
      function copyInstall() {
        const cmd = document.getElementById('install-cmd')?.textContent ?? '';
        navigator.clipboard.writeText(cmd).then(() => {
          const btn = document.querySelector('.copy-btn');
          if (btn) {
            btn.textContent = 'COPIED';
            setTimeout(() => { btn.textContent = 'COPY'; }, 1500);
          }
        });
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Run dev server and visually verify**

```bash
cd landing && npm run dev
```

Open `http://localhost:4321` and confirm:
- Brand name with blinking cursor at top
- `~~~` dividers between all sections
- `LABEL:` key-value pairs (PRODUCT, STATUS, VERSION, PLATFORM)
- Install command with COPY button
- All feature/comparison/links bullet lists
- Footer `~*~ © 2026 WORKBENCH ~*~`
- Light mode correct (white bg, dark text)
- Switch OS to dark mode — page should invert correctly

- [ ] **Step 3: Run build and confirm it passes**

```bash
cd landing && npm run build
```

Expected output ends with something like:
```
✓ Built in Xms
dist/
  index.html
  ...
```

No errors.

- [ ] **Step 4: Commit**

```bash
git add landing/src/pages/index.astro
git commit -m "feat(landing): build landing page with raw text-file aesthetic"
```

---

### Task 5: Cloudflare Pages config

**Files:**
- Create: `landing/wrangler.toml`

- [ ] **Step 1: Create `landing/wrangler.toml`**

```toml
name = "workbench-landing"
compatibility_date = "2024-01-01"
pages_build_output_dir = "./dist"
```

- [ ] **Step 2: Verify `astro build` output goes to `dist/`**

```bash
cd landing && npm run build && ls dist/
```

Expected: `index.html` present in `dist/`.

- [ ] **Step 3: Commit**

```bash
git add landing/wrangler.toml
git commit -m "feat(landing): add Cloudflare Pages wrangler config"
```

---

## Self-Review

**Spec coverage check:**
- ✓ `landing/` directory with Astro + Cloudflare static — Task 1
- ✓ Geist Variable + Geist Mono — Task 2
- ✓ shadcn CSS variable tokens, light + dark — Task 2
- ✓ Raw text-file aesthetic (brand, `~~~`, LABEL: rows, ` - items`) — Task 4
- ✓ Blinking cursor — Task 4
- ✓ Install command with copy button — Task 4
- ✓ All page sections (ABOUT, INSTALL, FEATURES, HOW IT COMPARES, LINKS, footer) — Task 4
- ✓ Mobile responsive — Task 4 (media query in `<style>`)
- ✓ Cloudflare Pages config — Task 5
- ✓ No images, text-only — Task 4

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks are complete.

**Type consistency:** No shared types across tasks — single-file page, N/A.
