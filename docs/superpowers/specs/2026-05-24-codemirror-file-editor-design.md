# CodeMirror File Editor — Design Spec

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** `src/modules/file-explorer` + `server/modules/workspace`

---

## Overview

Replace the read-only `@pierre/diffs` CodeView in the file explorer with a CodeMirror 6 editor that supports full file editing and Cmd+S save-to-disk.

---

## Architecture

Two layers of change:

1. **Server** — new `PUT /worktrees/:id/files/content` endpoint to write files to disk
2. **Client** — new `CodeMirrorEditor.vue` replaces `FilePreviewCodeView.vue`

---

## Server Changes

### New endpoint: `PUT /worktrees/:id/files/content`

- **File:** `server/modules/workspace/files.ts` (add `writeFileForWorktree`)
- **Router:** `server/modules/workspace/router.ts` (register the route)
- **Body:** `{ path: string, content: string }` — validated with Zod
- **Auth:** same `requireSession` middleware as existing file endpoints
- **Behaviour:** resolves the absolute path from the worktree root, then `fs.writeFile(absolutePath, content, "utf-8")`
- **Error handling:** `FileReadError`-pattern class `FileWriteError` with appropriate status codes (400 for invalid path, 404 for worktree not found)
- **Security:** path must not escape the worktree root (prefix check, same as `readFileForWorktree`)

---

## Client Changes

### `CodeMirrorEditor.vue`

**Location:** `src/modules/file-explorer/components/CodeMirrorEditor.vue`

**Props:**
```ts
filePath: string
content: string   // initial content from query cache
```

**Emits:**
```ts
save: (filePath: string, content: string) => void
change: () => void   // fired on any document transaction (for dirty tracking)
```

**Internals:**
- Creates an `EditorView` on `onMounted`, destroys it on `onBeforeUnmount`
- Document reset when `filePath` prop changes: dispatch a `StateEffect` that replaces the full document and resets history. A `resetting` flag is set during this operation so the `change` emit is suppressed — preventing a false dirty signal when switching files
- **Language detection:** `detectLanguage(filePath: string): LanguageSupport | null` helper in `src/modules/file-explorer/lib/detect-language.ts`. Maps extension → CM6 language package. Supported initially: `ts/tsx/js/jsx`, `py`, `json`, `css`, `html`, `md`, `sh`. Falls back to no language (plain text)
- **Theme:** wired to `useAppColorMode` — dark mode uses CM6's `oneDark`, light mode uses a minimal light theme. Theme swapped via `EditorView.reconfigure` when color mode changes
- **Keymap:** `keymap.of([{ key: "Mod-s", run: () => { emit("save", ...); return true; } }])` — prevents browser save dialog
- **Scrollbar:** `EditorView.theme` override to match app's scrollbar sizing (9px thumb, 12px track)
- **Font:** `fontFamily: var(--font-app-mono)` via EditorView theme

### `useFileEditorSave` composable

**Location:** `src/modules/file-explorer/hooks/use-file-editor-save.ts`

**Interface:**
```ts
useFileEditorSave(worktreeId: MaybeRefOrGetter<string>): {
  save: (path: string, content: string) => Promise<void>
  isSaving: Ref<boolean>
  saveError: Ref<Error | null>
}
```

- Uses TanStack Query `useMutation` for `PUT /worktrees/:id/files/content`
- On success: invalidates `workspaceKeys.fileContent(worktreeId, path)` so the query cache reflects the saved content
- On error: shows a `vue-sonner` toast with the error message

### API client

**File:** `src/api/workspace.ts` — add a typed route for `PUT /worktrees/:id/files/content` using the existing Hono client pattern.

---

## Dirty State

Tracked in `FileExplorerPanel.vue`:

```ts
const dirtyPaths = ref<Set<string>>(new Set())
```

- Set: on `change` emit from `CodeMirrorEditor`
- Cleared: after a successful save, or when a file tab is closed
- Also cleared: when a new file's content is loaded (switching tabs resets the editor, which is not a user edit)

`dirtyPaths` is passed as a prop to `FileTabList.vue`. The tab renders a small dot indicator when `dirtyPaths.has(path)`.

---

## Tab Switch with Unsaved Changes

When `closeFileTabHandler` or `openFileInTab` is called and `dirtyPaths` contains the currently active path:

- Show a `reka-ui` `AlertDialog`: "You have unsaved changes in `filename`. Discard them?"
- **Discard** → remove from `dirtyPaths`, proceed with navigation
- **Cancel** → do nothing

---

## Data Flow

```
Select file
  → fileContentQueryOptions fetches content
  → content prop passed to CodeMirrorEditor
  → EditorView initialised with content

User edits
  → EditorView transaction
  → "change" emit → dirtyPaths.add(filePath)
  → Tab dot appears

Cmd+S
  → "save" emit (filePath, currentContent)
  → useFileEditorSave.save()
  → PUT /worktrees/:id/files/content
  → success: dirtyPaths.delete(filePath), invalidate query cache
  → error: sonner toast

Switch tab with unsaved changes
  → AlertDialog "Discard?"
  → Discard: dirtyPaths.delete, navigate
  → Cancel: stay
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/modules/file-explorer/components/CodeMirrorEditor.vue` | CM6 editor wrapper |
| `src/modules/file-explorer/lib/detect-language.ts` | Extension → CM6 language map |
| `src/modules/file-explorer/hooks/use-file-editor-save.ts` | Save mutation composable |
| `server/modules/workspace/files.ts` (modify) | Add `writeFileForWorktree` |
| `server/modules/workspace/router.ts` (modify) | Register PUT route |
| `src/api/workspace.ts` (modify) | Add PUT typed client route |

## Files to Modify

| File | Change |
|------|--------|
| `src/modules/file-explorer/pages/FileExplorerPanel.vue` | Replace `FilePreviewCodeView` with `CodeMirrorEditor`, wire save/change/dirty |
| `src/modules/file-explorer/components/FileTabList.vue` | Accept `dirtyPaths` prop, render dot indicator |

---

## Packages to Install

```
@codemirror/view
@codemirror/state
@codemirror/commands
@codemirror/language
@codemirror/lang-javascript
@codemirror/lang-python
@codemirror/lang-json
@codemirror/lang-css
@codemirror/lang-html
@codemirror/lang-markdown
@codemirror/theme-one-dark
```

---

## Out of Scope

- Collaborative editing / multi-cursor
- Find & replace panel
- Language server / autocomplete / LSP
- Binary file handling (already truncated by the server)
