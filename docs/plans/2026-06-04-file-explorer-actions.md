# File Explorer Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click context menu (copy name, new file, new folder, delete), drag-and-drop move, and multi-select delete to the file explorer.

**Architecture:** Three new Go HTTP endpoints handle filesystem mutations; Vue `useMutation` hooks call them via `fetch`; `@pierre/trees`' `setComposition()` API wires a VanJS-rendered context menu into the tree; `dragAndDrop: true` + `onMutation` listeners handle single and multi-file moves.

**Tech Stack:** Go (stdlib `os`/`filepath`), Vue 3, `@tanstack/vue-query`, `vanjs-core`, `@pierre/trees`, `vue-sonner` (toast).

**Spec:** `docs/specs/2026-06-04-file-explorer-actions-design.md`

---

## File Map

| File | Action |
|------|--------|
| `server-go/internal/workspace/files.go` | Add `CreateFile`, `DeleteFile`, `MoveFile` |
| `server-go/internal/workspace/files_test.go` | New — unit tests for the three functions |
| `server-go/internal/workspace/router.go` | Add 3 route handlers |
| `frontend/src/modules/file-explorer/hooks/use-file-mutations.ts` | New — `useCreateFile`, `useDeleteFile`, `useMoveFile` composables |
| `frontend/src/modules/file-explorer/lib/file-context-menu.ts` | New — VanJS context menu builder |
| `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue` | `setComposition`, `dragAndDrop`, delete dialog, new-entry dialog |

---

## Task 1: Go — Add CreateFile, DeleteFile, MoveFile

**Files:**
- Modify: `server-go/internal/workspace/files.go`

- [ ] **Add the three functions** at the bottom of `files.go`:

```go
// CreateFile creates an empty file (isDir=false) or directory (isDir=true)
// at relativePath inside the worktree. Parent directories are created as needed.
func CreateFile(worktreePath, relativePath string, isDir bool) error {
	absPath, err := AssertPathWithinRoot(worktreePath, relativePath)
	if err != nil {
		return err
	}
	if isDir {
		return os.MkdirAll(absPath, 0755)
	}
	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		return err
	}
	f, err := os.OpenFile(absPath, os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return &FileError{Msg: err.Error(), Status: 400}
	}
	return f.Close()
}

// DeleteFile removes a file or directory (recursively) at relativePath.
func DeleteFile(worktreePath, relativePath string) error {
	absPath, err := AssertPathWithinRoot(worktreePath, relativePath)
	if err != nil {
		return err
	}
	return os.RemoveAll(absPath)
}

// MoveFile moves or renames a file/directory from fromPath to toPath within the worktree.
func MoveFile(worktreePath, fromPath, toPath string) error {
	absFrom, err := AssertPathWithinRoot(worktreePath, fromPath)
	if err != nil {
		return err
	}
	absTo, err := AssertPathWithinRoot(worktreePath, toPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(absTo), 0755); err != nil {
		return err
	}
	return os.Rename(absFrom, absTo)
}
```

- [ ] **Build to confirm no compile errors:**

```bash
cd server-go && go build ./...
```

Expected: no output (success).

- [ ] **Commit:**

```bash
git add server-go/internal/workspace/files.go
git commit -m "feat(go): add CreateFile, DeleteFile, MoveFile to workspace"
```

---

## Task 2: Go — Unit Tests for File Functions

**Files:**
- Create: `server-go/internal/workspace/files_test.go`

- [ ] **Write the test file:**

```go
package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCreateFile_file(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "hello.txt", false); err != nil {
		t.Fatalf("CreateFile: %v", err)
	}
	info, err := os.Stat(filepath.Join(root, "hello.txt"))
	if err != nil {
		t.Fatalf("file not created: %v", err)
	}
	if info.IsDir() {
		t.Fatal("expected file, got directory")
	}
}

func TestCreateFile_directory(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "subdir", true); err != nil {
		t.Fatalf("CreateFile dir: %v", err)
	}
	info, err := os.Stat(filepath.Join(root, "subdir"))
	if err != nil {
		t.Fatalf("dir not created: %v", err)
	}
	if !info.IsDir() {
		t.Fatal("expected directory, got file")
	}
}

func TestCreateFile_nestedPath(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "a/b/c.txt", false); err != nil {
		t.Fatalf("CreateFile nested: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "a/b/c.txt")); err != nil {
		t.Fatalf("nested file not created: %v", err)
	}
}

func TestCreateFile_pathTraversal(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "../escape.txt", false); err == nil {
		t.Fatal("expected error for path traversal, got nil")
	}
}

func TestDeleteFile_file(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "del.txt")
	if err := os.WriteFile(target, []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := DeleteFile(root, "del.txt"); err != nil {
		t.Fatalf("DeleteFile: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatal("file still exists after delete")
	}
}

func TestDeleteFile_directory(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "mydir")
	if err := os.MkdirAll(filepath.Join(dir, "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := DeleteFile(root, "mydir"); err != nil {
		t.Fatalf("DeleteFile dir: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("dir still exists after delete")
	}
}

func TestMoveFile_rename(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "old.txt"), []byte("hi"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := MoveFile(root, "old.txt", "new.txt"); err != nil {
		t.Fatalf("MoveFile: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "old.txt")); !os.IsNotExist(err) {
		t.Fatal("old file still exists")
	}
	if _, err := os.Stat(filepath.Join(root, "new.txt")); err != nil {
		t.Fatal("new file not found")
	}
}

func TestMoveFile_toSubdir(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := MoveFile(root, "file.txt", "subdir/file.txt"); err != nil {
		t.Fatalf("MoveFile to subdir: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "subdir/file.txt")); err != nil {
		t.Fatal("moved file not found in subdir")
	}
}

func TestMoveFile_pathTraversal(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := MoveFile(root, "file.txt", "../outside.txt"); err == nil {
		t.Fatal("expected error for path traversal destination")
	}
}
```

- [ ] **Run the tests:**

```bash
cd server-go && go test ./internal/workspace/... -run "TestCreateFile|TestDeleteFile|TestMoveFile" -v
```

Expected: all PASS.

- [ ] **Commit:**

```bash
git add server-go/internal/workspace/files_test.go
git commit -m "test(go): add unit tests for CreateFile, DeleteFile, MoveFile"
```

---

## Task 3: Go — Register New Routes

**Files:**
- Modify: `server-go/internal/workspace/router.go`

- [ ] **Add the three route handlers** inside `RegisterRoutes` (place them in the Files section, after the existing `r.Get("/worktrees/{id}/files/content", ...)` and `r.Put("/worktrees/{id}/files/content", ...)` handlers):

```go
r.Post("/worktrees/{id}/files", func(w http.ResponseWriter, r *http.Request) {
    wt, err := GetWorktree(db, chi.URLParam(r, "id"))
    if err != nil || wt == nil {
        wsErr(w, "Worktree not found", http.StatusNotFound)
        return
    }
    var body struct {
        Path string `json:"path"`
        Type string `json:"type"` // "file" or "directory"
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Path) == "" {
        wsErr(w, "path is required", http.StatusBadRequest)
        return
    }
    if body.Type != "file" && body.Type != "directory" {
        wsErr(w, "type must be 'file' or 'directory'", http.StatusBadRequest)
        return
    }
    if err := CreateFile(wt.Path, body.Path, body.Type == "directory"); err != nil {
        wsErr(w, err.Error(), http.StatusBadRequest)
        return
    }
    jsonResp(w, map[string]bool{"ok": true}, http.StatusCreated)
    publishEvent(bus, "file-tree:"+chi.URLParam(r, "id"))
})

r.Delete("/worktrees/{id}/files", func(w http.ResponseWriter, r *http.Request) {
    wt, err := GetWorktree(db, chi.URLParam(r, "id"))
    if err != nil || wt == nil {
        wsErr(w, "Worktree not found", http.StatusNotFound)
        return
    }
    var body struct {
        Path string `json:"path"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Path) == "" {
        wsErr(w, "path is required", http.StatusBadRequest)
        return
    }
    if err := DeleteFile(wt.Path, body.Path); err != nil {
        wsErr(w, err.Error(), http.StatusBadRequest)
        return
    }
    jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
    publishEvent(bus, "file-tree:"+chi.URLParam(r, "id"))
})

r.Post("/worktrees/{id}/files/move", func(w http.ResponseWriter, r *http.Request) {
    wt, err := GetWorktree(db, chi.URLParam(r, "id"))
    if err != nil || wt == nil {
        wsErr(w, "Worktree not found", http.StatusNotFound)
        return
    }
    var body struct {
        From string `json:"from"`
        To   string `json:"to"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil ||
        strings.TrimSpace(body.From) == "" || strings.TrimSpace(body.To) == "" {
        wsErr(w, "from and to are required", http.StatusBadRequest)
        return
    }
    if err := MoveFile(wt.Path, body.From, body.To); err != nil {
        wsErr(w, err.Error(), http.StatusBadRequest)
        return
    }
    jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
    publishEvent(bus, "file-tree:"+chi.URLParam(r, "id"))
})
```

- [ ] **Build to confirm no compile errors:**

```bash
cd server-go && go build ./...
```

Expected: no output.

- [ ] **Commit:**

```bash
git add server-go/internal/workspace/router.go
git commit -m "feat(go): register POST /files, DELETE /files, POST /files/move routes"
```

---

## Task 4: Frontend — File Mutation Hooks

**Files:**
- Create: `frontend/src/modules/file-explorer/hooks/use-file-mutations.ts`

These hooks follow the same pattern as `use-file-editor-save.ts`. They use raw `fetch()` + `ensureOk` because the new Go routes are not in the Hono type router (`@server/api/index` does not include them).

- [ ] **Create the file:**

```ts
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";
import { toast } from "vue-sonner";
import { ensureOk } from "@/lib/api-error";
import { invalidateWorkspaceFs } from "@/modules/workspace/queries/invalidate-workspace-fs";

export function useCreateFile(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path, type }: { path: string; type: "file" | "directory" }) => {
      const id = toValue(worktreeId);
      const res = await fetch(`/api/worktrees/${id}/files`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, type }),
      });
      await ensureOk<{ ok: boolean }>(res);
    },
    onSuccess: () => invalidateWorkspaceFs(queryClient, toValue(worktreeId)),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create entry");
    },
  });
}

export function useDeleteFile(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      const id = toValue(worktreeId);
      const res = await fetch(`/api/worktrees/${id}/files`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      await ensureOk<{ ok: boolean }>(res);
    },
    onSuccess: () => invalidateWorkspaceFs(queryClient, toValue(worktreeId)),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete entry");
    },
  });
}

export function useMoveFile(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const id = toValue(worktreeId);
      const res = await fetch(`/api/worktrees/${id}/files/move`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      await ensureOk<{ ok: boolean }>(res);
    },
    onSuccess: () => invalidateWorkspaceFs(queryClient, toValue(worktreeId)),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to move entry");
    },
  });
}
```

- [ ] **Type-check:**

```bash
pnpm typecheck
```

Expected: no errors in `use-file-mutations.ts`.

- [ ] **Commit:**

```bash
git add frontend/src/modules/file-explorer/hooks/use-file-mutations.ts
git commit -m "feat(frontend): add useCreateFile, useDeleteFile, useMoveFile hooks"
```

---

## Task 5: Frontend — VanJS Context Menu

**Files:**
- Create: `frontend/src/modules/file-explorer/lib/file-context-menu.ts`

Follows the same pattern as `frontend/src/modules/context-queue/lib/context-queue-annotation-popover.ts`.

- [ ] **Create the file:**

```ts
import van from "vanjs-core";
import { cn } from "@/lib/utils";
import type {
  FileTreeContextMenuItem,
  FileTreeContextMenuOpenContext,
} from "@pierre/trees";

const { div, button, hr } = van.tags;

export type FileContextMenuActions = {
  onCopyName: (name: string) => void;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onDelete: (paths: string[], isDir: boolean) => void;
};

function menuItem(label: string, danger: boolean, onClick: () => void): HTMLElement {
  return button(
    {
      type: "button",
      class: cn(
        "flex w-full items-center rounded px-2 py-1.5 text-left text-sm cursor-default",
        "focus:outline-none",
        danger
          ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
          : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      ),
      onclick: onClick,
    },
    label,
  );
}

function separator(): HTMLElement {
  return hr({ class: "my-1 border-border" });
}

function parentPath(item: FileTreeContextMenuItem): string {
  if (item.kind === "directory") return item.path;
  const slash = item.path.lastIndexOf("/");
  return slash >= 0 ? item.path.slice(0, slash) : "";
}

export function createFileContextMenu(
  item: FileTreeContextMenuItem,
  context: FileTreeContextMenuOpenContext,
  actions: FileContextMenuActions,
  selectedPaths: readonly string[],
): HTMLElement {
  const isMultiSelect = selectedPaths.length > 1 && selectedPaths.includes(item.path);
  const copyLabel = item.kind === "directory" ? "Copy folder name" : "Copy filename";
  const deleteLabel = isMultiSelect ? `Delete ${selectedPaths.length} items` : "Delete";
  const parent = parentPath(item);

  const items: HTMLElement[] = [
    menuItem(copyLabel, false, () => {
      actions.onCopyName(item.name);
      context.close();
    }),
  ];

  if (item.kind === "directory") {
    items.push(
      separator(),
      menuItem("New File", false, () => {
        context.close({ restoreFocus: false });
        actions.onNewFile(parent);
      }),
      menuItem("New Folder", false, () => {
        context.close({ restoreFocus: false });
        actions.onNewFolder(parent);
      }),
    );
  }

  items.push(
    separator(),
    menuItem(deleteLabel, true, () => {
      context.close({ restoreFocus: false });
      const paths = isMultiSelect ? [...selectedPaths] : [item.path];
      actions.onDelete(paths, item.kind === "directory");
    }),
  );

  return div(
    {
      "data-file-tree-context-menu-root": "true",
      class: cn(
        "min-w-44 rounded-md border border-border bg-popover p-1",
        "shadow-md text-popover-foreground text-sm",
      ),
    },
    ...items,
  );
}
```

- [ ] **Type-check:**

```bash
pnpm typecheck
```

Expected: no errors in `file-context-menu.ts`.

- [ ] **Commit:**

```bash
git add frontend/src/modules/file-explorer/lib/file-context-menu.ts
git commit -m "feat(frontend): add VanJS file context menu builder"
```

---

## Task 6: Frontend — Wire setComposition in FileExplorerPanel

**Files:**
- Modify: `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue`

- [ ] **Add imports** at the top of the `<script setup>` block (after existing imports):

```ts
import {
  useCreateFile,
  useDeleteFile,
  useMoveFile,
} from "@/modules/file-explorer/hooks/use-file-mutations";
import { createFileContextMenu } from "@/modules/file-explorer/lib/file-context-menu";
```

- [ ] **Instantiate mutation hooks** (after the existing `const { save, isSaving } = useFileEditorSave(...)` line):

```ts
const createFileMutation = useCreateFile(() => props.worktreeId);
const deleteFileMutation = useDeleteFile(() => props.worktreeId);
const moveFileMutation = useMoveFile(() => props.worktreeId);
```

- [ ] **Add `setComposition` call** inside `mountTree()`, immediately after `tree.render({ fileTreeContainer: treeEl.value })`:

```ts
tree.setComposition({
  contextMenu: {
    triggerMode: "right-click",
    buttonVisibility: "when-needed",
    render: (item, context) =>
      createFileContextMenu(item, context, {
        onCopyName: (name) => navigator.clipboard.writeText(name),
        onNewFile: (parent) => handleNewEntry(parent, "file"),
        onNewFolder: (parent) => handleNewEntry(parent, "directory"),
        onDelete: (paths, isDir) => {
          pendingDeletePaths.value = paths.map((p) => ({ path: p, isDir }));
          deleteDialogOpen.value = true;
        },
      }, tree!.getSelectedPaths()),
  },
});
```

- [ ] **Type-check:**

```bash
pnpm typecheck
```

Expected: errors only about `handleNewEntry` and `pendingDeletePaths` not yet defined — those come in Tasks 7 and 8. If unresolved imports error, check the import paths.

- [ ] **Commit** (after Tasks 7–9 complete and typecheck passes — see note at end of Task 9).

---

## Task 7: Frontend — Enable Drag-and-Drop Move

**Files:**
- Modify: `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue`

- [ ] **Add `dragAndDrop: true`** to the `new FileTree({...})` constructor inside `mountTree()`. The constructor currently looks like:

```ts
tree = new FileTree({
  paths: newPaths,
  density: "compact",
  icons: "minimal",
  initialExpandedPaths: initialExpandedPaths(),
  onSelectionChange: syncSelectionToUrl,
  unsafeCSS: `...`,
});
```

Change to:

```ts
tree = new FileTree({
  paths: newPaths,
  dragAndDrop: true,
  density: "compact",
  icons: "minimal",
  initialExpandedPaths: initialExpandedPaths(),
  onSelectionChange: syncSelectionToUrl,
  unsafeCSS: `...`,
});
```

- [ ] **Add `onMutation` listeners** inside `mountTree()`, after `tree.render(...)`:

```ts
// Single file/folder move (drag one item)
tree.onMutation("move", ({ from, to }) => {
  moveFileMutation.mutate({ from, to });
});

// Multi-file move (drag a selection of multiple items)
tree.onMutation("batch", ({ events }) => {
  const moves = events.filter(
    (e): e is import("@pierre/trees").FileTreeMoveEvent => e.operation === "move",
  );
  if (moves.length === 0) return;
  Promise.all(moves.map(({ from, to }) => moveFileMutation.mutateAsync({ from, to })))
    .then(() => invalidateWorkspaceFs(queryClient, props.worktreeId))
    .catch(() => {/* toast already shown by useMoveFile onError */});
});
```

Add the `FileTreeMoveEvent` import at the top of the script block:

```ts
import type { FileTreeMoveEvent } from "@pierre/trees";
```

- [ ] **Type-check:**

```bash
pnpm typecheck
```

Expected: no new errors from these additions.

---

## Task 8: Frontend — Delete Confirmation Dialog

**Files:**
- Modify: `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue`

- [ ] **Add delete state refs** near the other `ref` declarations in `<script setup>`:

```ts
const deleteDialogOpen = ref(false);
const pendingDeletePaths = ref<{ path: string; isDir: boolean }[]>([]);
```

- [ ] **Add the delete handler function** (near `openFileInTab` and other handlers):

```ts
async function onDeleteConfirm() {
  deleteDialogOpen.value = false;
  const paths = pendingDeletePaths.value;
  pendingDeletePaths.value = [];
  await Promise.all(paths.map(({ path }) => deleteFileMutation.mutateAsync({ path })));
}
```

- [ ] **Add the AlertDialog** to the `<template>`, alongside the existing discard `<AlertDialog>`:

```html
<AlertDialog :open="deleteDialogOpen">
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        Delete {{ pendingDeletePaths.length === 1 ? pendingDeletePaths[0]?.path.split('/').at(-1) : `${pendingDeletePaths.length} items` }}?
      </AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel @click="deleteDialogOpen = false; pendingDeletePaths = []">
        Cancel
      </AlertDialogCancel>
      <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="onDeleteConfirm">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Type-check:**

```bash
pnpm typecheck
```

Expected: no errors.

---

## Task 9: Frontend — New File / New Folder Dialog

**Files:**
- Modify: `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue`

- [ ] **Add `Input` to imports** (check if it's already imported; if not, add):

```ts
import { Input } from "@/components/ui/input";
```

- [ ] **Add new-entry state refs**:

```ts
const newEntryDialogOpen = ref(false);
const newEntryName = ref("");
const newEntryParentPath = ref("");
const newEntryType = ref<"file" | "directory">("file");
```

- [ ] **Add the handler functions**:

```ts
function handleNewEntry(parentPath: string, type: "file" | "directory") {
  newEntryParentPath.value = parentPath;
  newEntryType.value = type;
  newEntryName.value = "";
  newEntryDialogOpen.value = true;
}

async function onNewEntryConfirm() {
  const name = newEntryName.value.trim();
  if (!name) return;
  const path = newEntryParentPath.value
    ? `${newEntryParentPath.value}/${name}`
    : name;
  newEntryDialogOpen.value = false;
  await createFileMutation.mutateAsync({ path, type: newEntryType.value });
}
```

- [ ] **Add the AlertDialog** to the `<template>`:

```html
<AlertDialog :open="newEntryDialogOpen">
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        {{ newEntryType === 'file' ? 'New File' : 'New Folder' }}
      </AlertDialogTitle>
      <AlertDialogDescription>
        Enter a name{{ newEntryParentPath ? ` inside "${newEntryParentPath}"` : '' }}.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <Input
      v-model="newEntryName"
      placeholder="filename.txt"
      class="mt-2"
      @keydown.enter="onNewEntryConfirm"
      @keydown.escape="newEntryDialogOpen = false"
    />
    <AlertDialogFooter class="mt-4">
      <AlertDialogCancel @click="newEntryDialogOpen = false">Cancel</AlertDialogCancel>
      <AlertDialogAction :disabled="!newEntryName.trim()" @click="onNewEntryConfirm">
        Create
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Full type-check** (covers Tasks 6–9 together):

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Build** to confirm no bundle errors:

```bash
pnpm run build
```

Expected: successful build with no errors.

- [ ] **Commit all FileExplorerPanel changes:**

```bash
git add frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue
git commit -m "feat(frontend): add context menu, drag-and-drop, delete and new-entry dialogs to file explorer"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Right-click context menu → Task 5 (VanJS builder) + Task 6 (setComposition)
- [x] Copy filename / copy folder name → Task 6 (`onCopyName` → `navigator.clipboard.writeText`)
- [x] Delete files → Task 6 (`onDelete`) + Task 8 (dialog + `useDeleteFile`)
- [x] Add file → Task 9 (`handleNewEntry` + `useCreateFile`)
- [x] Add folder → Task 9 (`handleNewEntry` with `type: "directory"`)
- [x] File/folder move (drag single) → Task 7 (`onMutation('move', ...)`)
- [x] Multi-select move (drag multiple) → Task 7 (`onMutation('batch', ...)`)
- [x] Multi-select delete → Task 5 (`isMultiSelect` check) + Task 8 (`pendingDeletePaths` array)
- [x] Go backend: CreateFile → Task 1 + 2
- [x] Go backend: DeleteFile → Task 1 + 2
- [x] Go backend: MoveFile → Task 1 + 2
- [x] Routes registered → Task 3
