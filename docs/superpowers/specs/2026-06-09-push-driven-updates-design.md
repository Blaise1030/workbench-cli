# Push-Driven Updates: File Explorer, Git Status, Sessions

**Date:** 2026-06-09  
**Status:** Approved

## Problem

The app feels sluggish because all UI panels rely on a 30-second polling interval as the primary update mechanism. The SSE bus exists and fires correctly for explicit UI mutations (commit, delete worktree, agent hooks), but three gaps prevent push-driven updates from working end-to-end:

1. **No filesystem watcher** — external file changes made by agents never trigger `git-status` or `file-tree` SSE events from the backend
2. **Frontend ignores `file-tree:*`** — the backend already publishes `file-tree:<id>` SSE events on file delete/move, but `useServerEvents` doesn't handle them
3. **Sessions query missing `refetchOnWindowFocus`** — git queries have it, sessions don't, so switching back to the tab doesn't trigger a refresh

## Goal

Make file explorer, git status, and agent status feel instant after any change — whether triggered by the user or by an external agent — without increasing polling frequency or memory pressure.

## Architecture

The SSE bus (`events.Bus`) is the single broadcast channel. The backend publishes named topics; the frontend's `useServerEvents` subscribes and invalidates the relevant TanStack Query cache entries. 30-second polling remains as a safety net.

### Data flow (after fix)

```
Agent writes file
  → fsnotify detects .git/index change
  → WorktreeWatcher debounces (100ms)
  → publishes "git-status:<id>" + "file-tree:<id>" to events.Bus
  → SSE streams to frontend
  → useServerEvents invalidates fileTree + gitStatus queries
  → UI re-fetches and updates
```

## Changes

### Frontend

**`apps/frontend/src/lib/server-events.ts`**

Add a handler for the `file-tree:*` topic alongside the existing `git-status:*` handler. Use `invalidateWorkspaceFs` which already invalidates both `fileTree` and `gitStatus` together:

```ts
} else if (topic.startsWith('file-tree:')) {
  const worktreeId = topic.slice('file-tree:'.length)
  void invalidateWorkspaceFs(qc, worktreeId)
}
```

Import `invalidateWorkspaceFs` from `@/modules/workspace/queries`.

**`apps/frontend/src/modules/sessions/queries.ts`**

Add `refetchOnWindowFocus: 'always'` to `sessionsQueryOptions` so switching back to the tab triggers an immediate refresh (mirrors the git query config):

```ts
refetchInterval: 30_000,
refetchIntervalInBackground: false,
refetchOnWindowFocus: 'always',
```

### Backend (Go)

**New file: `apps/server-go/internal/watcher/watcher.go`**

A `WorktreeWatcher` struct that:
- Accepts a `*events.Bus` at construction
- Maintains a map of `worktreeId → fsnotify.Watcher` (one watcher per worktree)
- `Watch(id, repoPath string)` — watches `<repoPath>/.git/index`; on any write/create event, debounces 100ms then publishes `git-status:<id>` and `file-tree:<id>` to the bus
- `Unwatch(id string)` — closes and removes the watcher for that worktree
- `Close()` — tears down all watchers (called on server shutdown)
- Thread-safe via `sync.Mutex`

Debounce implementation: each worktree has a `*time.Timer` that resets on each event; the publish fires when the timer expires. This absorbs rapid successive writes (e.g. an agent writing multiple files).

**`apps/server-go/internal/workspace/router.go`**

- Add `watcher *watcher.WorktreeWatcher` parameter to `RegisterRoutes`
- On `POST /projects/{id}/worktrees` success: call `watcher.Watch(wt.ID, wt.Path)`
- On `DELETE /worktrees/{id}` success: call `watcher.Unwatch(id)`

**App startup (`cmd/workbench-cli/main.go` or `appstate`)**

- Construct `WorktreeWatcher` with `state.EventBus`
- On startup, list all existing worktrees from DB and call `watcher.Watch` for each (so restarts pick up live projects)
- Pass watcher to `workspace.RegisterRoutes`
- Call `watcher.Close()` on graceful shutdown

### New dependency

`github.com/fsnotify/fsnotify` — MIT license, widely used (Viper, etc.), macOS/Linux/Windows support via native APIs (FSEvents / inotify / ReadDirectoryChangesW).

## What doesn't change

- `GIT_STATUS_REFETCH_INTERVAL_MS = 30_000` — kept as safety net, rarely fires with push working
- Sessions `refetchInterval: 30_000` — same
- Query key structure in `workspaceKeys`
- No new API endpoints
- Sessions SSE (`publishEvent(bus, "sessions")`) already fires on `/agent-status` and `/register` — no backend change needed

## Out of scope

- Watching file content changes for the editor (separate concern)
- Reducing polling intervals (not needed once push is working)
- Watching non-git repos for git status (they have no `.git/index`)
