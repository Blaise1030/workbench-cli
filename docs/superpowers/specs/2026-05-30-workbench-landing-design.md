# Workbench Landing Page — Design Spec

Date: 2026-05-30

## Summary

A static marketing landing page for **Workbench** — a GUI workspace manager for engineers running multiple Claude Code agents in parallel across git worktrees.

**Content inspiration:** herdr.dev (structure, sections, comparison table)
**Design inspiration:** code.storage / pierre.computer (raw text-file aesthetic, monospace, ALL CAPS labels)

---

## Product Positioning

- **Name:** Workbench
- **Tagline:** Mission control for parallel AI coding.
- **One-liner:** A single GUI for every git worktree, every Claude Code agent, and every running branch — all at once.
- **Primary CTA:** Install via curl — `curl -fsSL https://blaise1030.github.io/workbench-cli/install.sh | sh`
- **Install page:** https://blaise1030.github.io/workbench-cli/

### Differentiation

| | Tower / GitHub Desktop | herdr | Cursor / VS Code | **Workbench** |
|---|---|---|---|---|
| Git GUI | ✓ | — | — | ✓ |
| Parallel worktrees | — | — | — | ✓ |
| Agent awareness | — | ✓ | limited | ✓ |
| Standalone GUI | ✓ | — | ✓ | ✓ |
| Claude Code hooks | — | — | — | ✓ |

---

## Tech Stack

- **Framework:** Astro (static output)
- **Deployment:** Cloudflare Pages
- **Styling:** Tailwind CSS + shadcn CSS variables (light + dark theme)
- **Fonts:** `@fontsource-variable/geist` (body) + `@fontsource-variable/geist-mono` (monospace elements)
- **Location:** `landing/` directory at the project root

---

## Design System

### Typography
- Body: Geist Variable (sans-serif), 13px, line-height 1.6
- Monospace elements (labels, install cmd, dividers, brand): Geist Mono Variable
- ALL CAPS for labels and keys
- No decorative headings — labels replace `<h1>/<h2>` hierarchy

### Color
- shadcn CSS variable tokens: `--background`, `--foreground`, `--muted-foreground`, `--border`
- Light and dark mode via `prefers-color-scheme` — no dark-only
- Links: purple (`hsl(263 70% 60%)` light / `hsl(263 70% 72%)` dark)

### Layout
- Max-width: 680px, left-aligned, padding 32px 48px
- No centered content, no cards, no bordered boxes
- Sections separated by `~~~` text dividers

### Aesthetic
- Raw text-file / rendered-README feel (inspired by pierre.computer)
- `LABEL:` + value pairs for metadata
- ` - item` list style for features and links
- Blinking cursor after brand name
- `~*~ © 2026 WORKBENCH ~*~` footer line

---

## Page Sections (in order)

### 1. Brand + Cursor
```
WORKBENCH █
```
Blinking block cursor. No nav bar. No announcement banner.

### 2. Divider
```
~~~
```

### 3. Metadata block
```
PRODUCT: GUI WORKSPACE MANAGER FOR AI-DRIVEN DEVELOPMENT
STATUS:  AVAILABLE
VERSION: 0.1.0
PLATFORM: MACOS
```

### 4. Divider

### 5. About
```
ABOUT:
 [two short prose paragraphs describing Workbench]
```

### 6. Divider

### 7. Install
```
INSTALL:
 - curl -fsSL https://blaise1030.github.io/workbench-cli/install.sh | sh
 - [Install options](url)
 - [Releases](url)
```

### 8. Divider

### 9. Features
```
FEATURES:
 - Parallel git worktrees, tracked in one sidebar
 - Claude Code hook integration — notified when agents stop or complete tasks
 - Per-worktree terminal tabs, git panel, and file explorer
 - Line-level diffs, staged/unstaged review without leaving the app
 - Keybinding configuration and LAN network settings
 - Single binary — no Electron, no runtime dependencies
```

### 10. Divider

### 11. How it compares
```
HOW IT COMPARES:
 - Tower / GitHub Desktop: git GUIs, no worktree-first workflow, no agent awareness
 - herdr: lives inside your terminal, not a GUI
 - Cursor / VS Code: editors that run one agent at a time
 - Workbench: the only GUI built for parallel agents + git worktrees together
```

### 12. Divider

### 13. Links
```
LINKS:
 - [Docs](/docs)
 - [Source](https://github.com/Blaise1030/workbench-cli)
 - [Releases](/releases)
 - [Changelog](/changelog)
```

### 14. Divider + Footer
```
~~~
~*~ © 2026 WORKBENCH ~*~
```

---

## File Structure

```
landing/
  astro.config.mjs       # Astro static + Cloudflare adapter
  package.json
  tailwind.config.mjs
  tsconfig.json
  src/
    pages/
      index.astro        # Landing page (single page)
    styles/
      global.css         # shadcn CSS vars, Geist font imports, base styles
  public/
    favicon.ico
```

---

## Constraints

- No JavaScript required for the page to render (pure static)
- Copy button on install command may use a small inline script
- No images or screenshots — text only
- Responsive down to mobile (max-width collapses to full-width with reduced padding)
