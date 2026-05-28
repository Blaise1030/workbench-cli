# Command Palette (⌘K) — Design Spec

**Date:** 2026-05-29  
**Status:** Approved

---

## Overview

A global command palette triggered by ⌘K. Unified single input with prefix-based mode switching: default mode for navigation and actions, `@` prefix for fuzzy file search within the active worktree.

---

## Architecture

New module: `frontend/src/modules/command-palette/`

```
command-palette/
  CommandPalette.vue      # modal UI, keyboard navigation, result rendering
  useCommandPalette.ts    # module-level singleton: open/close state, active worktreeId
  commands.ts             # static command registry (navigate + actions)
  useFileSearch.ts        # server-side fuzzy file search composable
```

The palette is mounted once at the app root (either `App.vue` or `WorkspaceView.vue`) so it is globally available. The existing `keyboard` module registers the ⌘K shortcut and calls `openCommandPalette()` from `useCommandPalette.ts`.

---

## Input & Mode Switching

The palette has a single text input. Mode is derived from the input value at runtime — no explicit toggle.

| Input | Mode | Behaviour |
|-------|------|-----------|
| `hello` | Commands | Fuzzy-filter the static command registry |
| `@hello` | File search | Server-side fuzzy file search; query = input after `@` |

When in `@` mode a small `Files` badge appears next to the input as a mode indicator.

**Commands mode result sections:**

- **Navigate** — worktrees, panels (terminal, git, explorer)
- **Actions** — add project, open settings, toggle theme

**File search mode:** flat list of matching relative file paths with matched characters highlighted.

---

## Selection & Navigation

Keyboard: `↑`/`↓` to move, `Enter` to select, `Escape` to close. Palette closes immediately on any selection.

Navigation results are rendered as `<RouterLink>` components using the `custom` slot pattern so they remain styled list items but behave as native links (right-click → open in new tab works).

Actions that have no route (add project, toggle theme) remain as button-triggered handlers.

| Item type | Action |
|-----------|--------|
| Worktree | RouterLink → `{ name: 'workspace', params: { worktreeId } }` |
| Terminal panel | RouterLink → `{ name: 'terminal', params: { worktreeId, terminalId } }` |
| Git panel | RouterLink → `{ name: 'git', params: { worktreeId } }` |
| Explorer panel | RouterLink → `{ name: 'explorer', params: { worktreeId } }` |
| Settings | RouterLink → `{ name: 'settings' }` |
| Add project | Button → triggers existing `addProject()` flow |
| Toggle theme | Button → calls existing `ThemeToggle` logic |
| File result | RouterLink → `{ name: 'explorer', query: { file: 'src/foo/bar.ts' } }` |

File selection navigates to the explorer panel. `FileExplorerPanel` reads the `?file=` query param on mount and scrolls/highlights the matching entry.

---

## File Search (`@` mode)

File search is **server-side** to avoid loading the entire worktree file tree into client memory.

**New Go endpoint:**
```
GET /api/worktrees/:id/search/files?q=<query>&limit=50
```
The backend performs a recursive directory walk scoped to the worktree root, fuzzy-matches file paths against `q`, and returns up to `limit` results ranked by match quality (filename match ranked above path match).

**Client behaviour:**
- Input is debounced 150ms before the request fires
- Only the returned results (max 50) are rendered — no large in-memory file list
- If no worktree is active (e.g. home screen), the `@` prefix shows a "No active worktree" empty state and makes no request

**Performance notes:**
- No client-side file tree cache; all matching is backend-owned
- Virtual list rendering is not needed given the 50-result cap
- If backend search proves slow for very large repos, a future optimisation is to maintain a background-indexed file manifest on the Go side

---

## Out of Scope (v1)

- Additional prefix modes beyond `@` (can be added later as new use cases emerge)
- In-palette file preview
- Search history / recently opened files

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `frontend/src/modules/command-palette/CommandPalette.vue` | New |
| `frontend/src/modules/command-palette/useCommandPalette.ts` | New |
| `frontend/src/modules/command-palette/commands.ts` | New |
| `frontend/src/modules/command-palette/useFileSearch.ts` | New |
| `frontend/src/App.vue` or `WorkspaceView.vue` | Mount `<CommandPalette>`, register ⌘K |
| `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue` | Read `?file=` query param on mount |
| `server-go/internal/workspace/router.go` | Add `GET /worktrees/:id/search/files` route |
| `server-go/internal/workspace/` | New handler: file search logic |
