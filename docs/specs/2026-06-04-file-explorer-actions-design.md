# File Explorer Actions Design

**Date:** 2026-06-04  
**Status:** Approved

## Overview

Add right-click context menu, file/folder CRUD, drag-and-drop move, and multi-select move to the file explorer. The tree UI is powered by `@pierre/trees` (`FileTree` class); all new actions integrate through its documented composition API.

---

## 1. Backend — New Go Endpoints

**Location:** `server-go/internal/workspace/files.go` + `router.go`

### New functions in `files.go`

```go
CreateFile(worktreePath, relativePath string, isDir bool) error
DeleteFile(worktreePath, relativePath string) error
MoveFile(worktreePath, from, to string) error
```

All three use the existing `assertPathWithinRoot` guard to prevent path traversal. All emit `publishEvent(bus, "file-tree:"+worktreeId)` so the frontend invalidates via its existing SSE mechanism.

### New routes in `router.go`

| Method | Path | Body |
|--------|------|------|
| `POST` | `/worktrees/{id}/files` | `{ "path": "relative/path", "type": "file"\|"directory" }` |
| `DELETE` | `/worktrees/{id}/files` | `{ "path": "relative/path", "recursive": true }` |
| `POST` | `/worktrees/{id}/files/move` | `{ "from": "old/path", "to": "new/path" }` |

`POST /files` with `type: "file"` creates an empty file (including parent dirs). With `type: "directory"` creates the directory. `DELETE` with `recursive: true` handles non-empty directories. `POST /files/move` uses `os.Rename` which handles both rename-in-place and cross-directory moves atomically.

---

## 2. Frontend — API Type Definitions

The Hono RPC client (`apiClient`) is typed via `@server/api/index`. The 3 new Go routes must be added there so `apiClient.worktrees[":id"].files.$post()` etc. are type-safe.

---

## 3. Frontend — Mutation Hooks

**Location:** `frontend/src/modules/file-explorer/queries/files.ts`

Add three mutation option functions following the existing `fileContentQueryOptions` pattern:

```ts
createFileMutationOptions(worktreeId: MaybeRefOrGetter<string>)
deleteFileMutationOptions(worktreeId: MaybeRefOrGetter<string>)
moveFileMutationOptions(worktreeId: MaybeRefOrGetter<string>)
```

Each calls `invalidateWorkspaceFs(queryClient, worktreeId)` on success to refresh the file tree. No optimistic updates — the tree is synced from the server after each operation.

---

## 4. Frontend — Context Menu (VanJS)

**New file:** `frontend/src/modules/file-explorer/lib/file-context-menu.ts`

Uses `vanjs-core` to build the `HTMLElement` returned to pierre/trees' `render` callback — the same pattern used in `context-queue-annotation-popover.ts`. The root element carries `data-file-tree-context-menu-root="true"` so pierre/trees treats internal clicks as inside-menu.

```ts
import van from "vanjs-core"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FileContextMenuActions = {
  onCopyName: (name: string) => void
  onNewFile: (parentPath: string) => void
  onNewFolder: (parentPath: string) => void
  onDelete: (path: string, isDir: boolean) => void
}

export function createFileContextMenu(
  item: FileTreeContextMenuItem,
  context: FileTreeContextMenuOpenContext,
  actions: FileContextMenuActions,
): HTMLElement
```

### Menu items by node type

| Action | File | Directory |
|--------|------|-----------|
| Copy filename / Copy folder name | ✓ | ✓ |
| New File (inside) | — | ✓ |
| New Folder (inside) | — | ✓ |
| Delete | ✓ | ✓ |

**Styling:** Uses existing `buttonVariants` + Tailwind utility classes from the design system. Menu shell matches the annotation popover shell style (`bg-popover border border-border rounded shadow-sm`).

**Positioning:** pierre/trees positions the menu container; the `render` callback only needs to return the content element.

### Wiring in `FileExplorerPanel.vue`

Call `tree.setComposition()` immediately after `tree.render()` in `mountTree()`:

```ts
tree.setComposition({
  contextMenu: {
    triggerMode: 'right-click',
    buttonVisibility: 'when-needed',
    render: (item, context) => createFileContextMenu(item, context, {
      onCopyName: (name) => navigator.clipboard.writeText(name),
      onNewFile: (parentPath) => handleNewEntry(parentPath, 'file'),
      onNewFolder: (parentPath) => handleNewEntry(parentPath, 'directory'),
      onDelete: (path, isDir) => {
        pendingDeletePath.value = { path, isDir }
        deleteDialogOpen.value = true
        context.close({ restoreFocus: false })
      },
    }),
  },
})
```

---

## 5. Frontend — New File / New Folder Flow

When "New File" or "New Folder" is triggered from the context menu:

1. Call `POST /worktrees/{id}/files` with a placeholder name (e.g. `parent/untitled` or `parent/untitled-folder`).
2. The tree invalidates and the new entry appears.
3. Immediately call `tree.startRenaming(placeholderPath, { removeIfCanceled: true })`.
4. If the user confirms the rename: call `POST /worktrees/{id}/files/move` with `{ from: placeholder, to: newName }`, then invalidate.
5. If the user cancels: call `DELETE /worktrees/{id}/files` to remove the placeholder, then invalidate.

This gives the VS Code-style inline name entry UX, using pierre/trees' built-in rename input.

---

## 6. Frontend — Delete Flow

Delete uses the existing `AlertDialog` pattern already in `FileExplorerPanel.vue`. Two new reactive refs are added:

```ts
const deleteDialogOpen = ref(false)
const pendingDeletePaths = ref<{ path: string; isDir: boolean }[]>([])
```

On confirm: call `DELETE /worktrees/{id}/files` for each pending path (with `recursive: true` for directories), then invalidate once after all deletions complete. On cancel: clear `pendingDeletePaths`.

### Multi-select delete

Inside the `render` callback, read `tree.getSelectedPaths()`. If the right-clicked item's path is in the current selection and the selection has more than one item, show **"Delete X items"** and populate `pendingDeletePaths` with all selected paths. Otherwise show "Delete" for just the single item.

---

## 7. Frontend — Drag-and-Drop Move + Multi-Select

Enable drag-and-drop in the `FileTree` constructor:

```ts
new FileTree({
  paths: newPaths,
  dragAndDrop: true,       // ← add this
  density: "compact",
  icons: "minimal",
  // ...existing options
})
```

Listen for both single and batch move mutations. `canDrag` receives the full selection array, confirming multi-select drag is natively supported:

```ts
tree.onMutation('move', ({ from, to }) => {
  moveFileMutation.mutate({ from, to })
})

tree.onMutation('batch', ({ events }) => {
  const moves = events.filter((e): e is FileTreeMoveEvent => e.operation === 'move')
  // fire one API call per move; invalidate once after all settle
  Promise.all(moves.map(({ from, to }) => moveFileMutation.mutateAsync({ from, to })))
    .then(() => invalidateWorkspaceFs(queryClient, worktreeId))
})
```

When multiple files are selected and dragged to a folder, pierre/trees fires a single `batch` event containing all the individual move operations — **not** multiple `move` events. Listening to only `move` would silently drop multi-file drags.

---

## 8. Files Created / Modified

| File | Action |
|------|--------|
| `server-go/internal/workspace/files.go` | Add `CreateFile`, `DeleteFile`, `MoveFile` functions |
| `server-go/internal/workspace/router.go` | Register 3 new routes |
| `server/api/index.ts` *(or equivalent)* | Add 3 route types for Hono RPC client |
| `frontend/src/modules/file-explorer/queries/files.ts` | Add 3 mutation option functions |
| `frontend/src/modules/file-explorer/lib/file-context-menu.ts` | **New** — VanJS context menu builder |
| `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue` | `setComposition()`, `dragAndDrop`, delete dialog state, new-entry handler |

---

## 9. Out of Scope

- **Copy filename to clipboard for multiple selections** — single item only via context menu.
- **"Move to folder" dialog** — drag-and-drop covers the use case.
- **Visual-only sort order** — reordering means actual filesystem move (Option A confirmed).
- **Undo** — not implemented; destructive actions use confirmation dialogs.
