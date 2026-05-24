# File Explorer — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Implement the `FileExplorerPanel` using `@pierre/trees` (vanilla JS API) to display a browsable file tree for the active worktree. Files are read-only. Selection writes the chosen file's full path to the URL as an encoded query parameter.

## Architecture

### 1. Server endpoint — `GET /worktrees/:id/files`

- Added to the existing workspace Hono router
- Looks up the worktree path from the DB
- Recursively walks the directory using Node's `fs.readdir` with `{ withFileTypes: true, recursive: true }`
- Skips noise directories: `node_modules`, `.git`, `.next`, `dist`, `.turbo`, `.cache`, `__pycache__`, `.venv`
- Returns `{ paths: string[] }` — relative POSIX paths from the worktree root (e.g. `src/components/Button.tsx`)

### 2. API layer — `fileTreeQueryOptions`

- Added to `src/api/workspace.ts` following existing patterns
- `queryKey`: `workspaceKeys.fileTree(worktreeId)` (new key added to `workspaceKeys`)
- Fetches once on mount (`staleTime: Infinity`, no polling — tree structure doesn't change frequently)
- Returns `string[]`

### 3. `FileExplorerPanel.vue`

**Data:**
- Fetches `fileTreeQueryOptions(worktreeId)` for paths
- Reads `gitStatusQueryOptions(worktreeId)` (already polled every 5s) for git annotations

**Tree mounting:**
- A `div` ref (`treeEl`) is the mount target
- In `onMounted`: `new FileTree({ el: treeEl.value, paths, gitStatus })` from `@pierre/trees`
- In `onUnmounted`: `tree.destroy()`
- When `gitStatus` data updates (via `watch`): `tree.setGitStatus(gitStatusMap)`

**Git status mapping:**
Maps `GitStatusEntry[]` → `Record<string, GitStatusCode>` for `@pierre/trees`:
- `added` → `"added"`
- `modified` → `"modified"`
- `deleted` → `"deleted"`
- `renamed` → `"renamed"`
- `untracked` → `"untracked"`
- Staged status takes priority over unstaged when both are set

**URL query param (file selection):**
- On file select: write `?file=<encodeURIComponent(fullPath)>` to the URL using `vue-router`'s `router.replace`
- On mount: read `route.query.file`, `decodeURIComponent` it, and call `tree.getItem(path)?.select()` to restore selection
- Full path = `worktree.path + '/' + relativePath`

## Data flow

```
Server fs.readdir (recursive, filtered)
  → GET /worktrees/:id/files
  → fileTreeQueryOptions
  → FileExplorerPanel: new FileTree({ el, paths })

gitStatusQueryOptions (existing, 5s poll)
  → watch → tree.setGitStatus(mapped)

user clicks file
  → router.replace({ query: { file: encodeURIComponent(fullPath) } })
  ← route.query.file on mount → decodeURIComponent → tree.getItem()?.select()
```

## Package

- Install `@pierre/trees` (vanilla entry point)
- No React dependency needed
