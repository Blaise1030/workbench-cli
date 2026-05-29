# Markdown Filter Toggle — Design Spec

Date: 2026-05-29

## Overview

Add a toggle icon button in the file tree sidebar header (beside the existing Search button) that filters the file tree to show only `.md` files. State persists per-worktree in localStorage.

## Components

### `file-explorer-storage.ts`

Add one optional field to `FileExplorerWorktreeState`:

```ts
markdownOnly?: boolean;
```

No other changes to storage logic needed — the existing `useLocalStorage` call picks up new fields automatically.

### `FileExplorerPanel.vue`

**State:**
- `showMarkdownOnly` — a computed getter/setter that reads/writes `explorerState.value.markdownOnly`

**Filtered paths:**
- `filteredPaths` computed: when `showMarkdownOnly` is true, filter `paths.value` to entries ending in `.md`; otherwise return `paths.value` unchanged

**Tree lifecycle:**
- Watch `showMarkdownOnly`: on change, call `teardownTree()` then `tryMountTree()` with the filtered paths
- `mountTree` uses `filteredPaths` instead of raw `paths.value`

**Button:**
- `FileTextIcon` from `@lucide/vue` (already available as a peer import)
- Placed in the `<div class="flex shrink-0 items-center justify-end px-1 py-0.5">` container, before the `SearchIcon` button
- Uses `variant="ghost" size="icon-xs"`
- Active state: `text-foreground` when on, `text-muted-foreground` when off
- `aria-label`: `"Show markdown files only"` / `"Show all files"`

## Behaviour

| State | Tree shows | Button appearance |
|---|---|---|
| Off (default) | All files | muted icon |
| On | `.md` files only | highlighted icon |

Toggling re-mounts the tree (expanded folder state resets — acceptable for a filter operation).

## Files Changed

- `frontend/src/modules/file-explorer/lib/file-explorer-storage.ts` — add `markdownOnly` field
- `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue` — state, computed, watch, button
