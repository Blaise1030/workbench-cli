# Markdown Filter Toggle + Preview — Design Spec

Date: 2026-05-29

## Overview

Two related features:

1. **Markdown filter toggle** — a button in the file tree sidebar header that filters the tree to `.md` files only. State persists per-worktree in localStorage.
2. **Markdown preview toggle** — when the active tab is a `.md` file, a toggle appears in `FileTabList` to switch between code editor and rendered preview mode.

---

## Feature 1: Markdown Filter Toggle

### `file-explorer-storage.ts`

Add one optional field to `FileExplorerWorktreeState`:

```ts
markdownOnly?: boolean;
```

### `FileExplorerPanel.vue`

- `showMarkdownOnly` — computed getter/setter over `explorerState.value.markdownOnly`
- `filteredPaths` computed: filter `paths.value` to `.md` entries when active, else pass all paths
- Watch `showMarkdownOnly`: teardown + remount tree with filtered paths
- `mountTree` uses `filteredPaths` instead of raw `paths.value`

**Button:** `FileTextIcon` beside `SearchIcon` in the tree panel header  
- `variant="ghost" size="icon-xs"`  
- `text-foreground` when on, `text-muted-foreground` when off  
- `aria-label`: `"Show markdown files only"` / `"Show all files"`

---

## Feature 2: Markdown Preview Toggle

### Dependencies

Add `markdown-it` (with built-in table support) and `@types/markdown-it`. Also add `DOMPurify` + `@types/dompurify` for safe HTML sanitization before rendering.

### `FileTabList.vue`

**New prop:**
```ts
markdownPreview?: boolean;
```

**New emit:**
```ts
toggleMarkdownPreview: [];
```

**Button:** Appears only when `activePath` ends with `.md`  
- Uses `EyeIcon` (preview on) / `CodeIcon` (editor mode) from `@lucide/vue`  
- Placed between the Save button and the collapse-tree button  
- `variant="ghost" size="icon-xs"`  
- Active state: `text-foreground` when preview is on, `text-muted-foreground` when off

### `MarkdownPreview.vue` (new component)

Location: `frontend/src/modules/file-explorer/components/MarkdownPreview.vue`

- Accepts `content: string` prop
- Renders via `markdown-it` with `{ html: false, tables: true, linkify: true }`
- Sanitizes output with `DOMPurify.sanitize(...)` before `v-html`
- Styled with Tailwind `prose` classes (via `@tailwindcss/typography` — check if installed, add if not)
- Scrollable, matches editor area sizing

### `FileExplorerPanel.vue`

- Add `markdownPreview = ref(false)`
- Pass `:markdown-preview="markdownPreview"` and `@toggle-markdown-preview="markdownPreview = !markdownPreview"` to `FileTabList`
- Watch `selectedRelativePath`: reset `markdownPreview = false` when switching to a non-`.md` file
- In the editor region: show `MarkdownPreview` when `markdownPreview && fileContent`, otherwise show `CodeMirrorEditor`

---

## Behaviour Summary

| Condition | UI shown |
|---|---|
| Active file is not `.md` | No preview toggle visible |
| Active file is `.md`, preview off | CodeMirrorEditor + toggle button visible |
| Active file is `.md`, preview on | MarkdownPreview + toggle button highlighted |
| Markdown filter on | Tree shows `.md` files only, button highlighted |

---

## Files Changed / Created

| File | Action |
|---|---|
| `lib/file-explorer-storage.ts` | Add `markdownOnly` field |
| `pages/FileExplorerPanel.vue` | Filter state, preview state, remount logic, button |
| `components/FileTabList.vue` | New prop/emit, preview toggle button |
| `components/MarkdownPreview.vue` | New — markdown renderer component |
