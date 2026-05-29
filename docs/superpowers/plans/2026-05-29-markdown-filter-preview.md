# Markdown Filter Toggle + Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a markdown-only filter toggle to the file tree sidebar and a markdown preview toggle in the editor tab bar.

**Architecture:** Feature 1 adds a `markdownOnly` boolean to the existing per-worktree localStorage state and passes filtered paths to the `FileTree` on remount. Feature 2 adds a new `MarkdownPreview.vue` component rendered via `markdown-it` + `DOMPurify`, toggled via a new prop/emit pair on `FileTabList`, wired in `FileExplorerPanel`.

**Tech Stack:** Vue 3 (Composition API), `markdown-it` (tables enabled), `DOMPurify` (XSS sanitisation), Vitest, Tailwind CSS v4 (Vite plugin — no typography plugin)

---

## File Map

| File | Action |
|---|---|
| `frontend/src/modules/file-explorer/lib/file-explorer-storage.ts` | Add `markdownOnly` field |
| `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue` | Filter state + computed + remount watch + filter button + preview state + conditional render |
| `frontend/src/modules/file-explorer/components/FileTabList.vue` | New `markdownPreview` prop, `toggleMarkdownPreview` emit, preview toggle button |
| `frontend/src/modules/file-explorer/components/MarkdownPreview.vue` | New — renders markdown via markdown-it + DOMPurify |

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json` (lockfile auto-updated)

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
cd /Users/blaisetiong/Developer/v2/frontend
npm install markdown-it dompurify
npm install -D @types/markdown-it @types/dompurify
```

Expected output: packages added, no peer dependency warnings.

- [ ] **Step 2: Verify installed**

```bash
ls node_modules | grep -E "markdown-it|dompurify"
```

Expected: `markdown-it` and `dompurify` listed.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add markdown-it and dompurify dependencies"
```

---

## Task 2: Add `markdownOnly` to storage type

**Files:**
- Modify: `frontend/src/modules/file-explorer/lib/file-explorer-storage.ts`

- [ ] **Step 1: Add field to the interface**

In `file-explorer-storage.ts`, update `FileExplorerWorktreeState`:

```ts
export interface FileExplorerWorktreeState {
  /** Tree panel size as a percentage of the split (15–55). */
  treeSize?: number;
  /** Path relative to the worktree root. */
  lastFilePath?: string;
  /** Open file tabs (relative paths), in tab order. Scoped per worktree. */
  openFiles?: string[];
  /** Folder paths expanded in the file tree sidebar. */
  expandedPaths?: string[];
  /** Whether to show only .md files in the file tree. */
  markdownOnly?: boolean;
}
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
cd /Users/blaisetiong/Developer/v2/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/file-explorer/lib/file-explorer-storage.ts
git commit -m "feat(storage): add markdownOnly field to file explorer state"
```

---

## Task 3: Markdown filter toggle in FileExplorerPanel

**Files:**
- Modify: `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue`

The tree panel header is at line ~635. `tryMountTree` (line ~430) currently reads `paths.value` directly — we'll change it to use a `filteredPaths` computed.

- [ ] **Step 1: Add `FileTextIcon` to the import**

Find the existing lucide import in `FileExplorerPanel.vue`:

```ts
import { FileIcon, FolderTreeIcon, SearchIcon } from "@lucide/vue";
```

Replace with:

```ts
import { FileIcon, FileTextIcon, FolderTreeIcon, SearchIcon } from "@lucide/vue";
```

- [ ] **Step 2: Add `showMarkdownOnly` computed and `filteredPaths` computed**

After the line `const explorerState = useFileExplorerStorage(() => props.worktreeId);`, add:

```ts
const showMarkdownOnly = computed({
  get: () => explorerState.value.markdownOnly ?? false,
  set: (val: boolean) => {
    explorerState.value = { ...explorerState.value, markdownOnly: val };
  },
});

const filteredPaths = computed(() => {
  const all = paths.value;
  if (!all) return null;
  if (!showMarkdownOnly.value) return all;
  return all.filter((p) => p.endsWith(".md"));
});
```

- [ ] **Step 3: Update `tryMountTree` to use `filteredPaths`**

Find:

```ts
function tryMountTree() {
  const newPaths = paths.value;
  if (!newPaths) return;
  mountTree(newPaths);
}
```

Replace with:

```ts
function tryMountTree() {
  const newPaths = filteredPaths.value;
  if (!newPaths) return;
  mountTree(newPaths);
}
```

- [ ] **Step 4: Add watch to remount when filter toggles**

After the existing `watch([() => paths.value, treeEl], ...)` block, add:

```ts
watch(showMarkdownOnly, () => {
  teardownTree();
  nextTick(() => tryMountTree());
});
```

- [ ] **Step 5: Add the filter button in the template**

Find the tree panel header div in the template (around line 635):

```html
<div class="flex shrink-0 items-center justify-end px-1 py-0.5">
  <Button
    variant="ghost"
    size="icon-xs"
    aria-label="Search files"
    @click="openWithFileSearch"
  >
    <SearchIcon class="size-3.5" />
  </Button>
</div>
```

Replace with:

```html
<div class="flex shrink-0 items-center justify-end px-1 py-0.5">
  <Button
    variant="ghost"
    size="icon-xs"
    :aria-label="showMarkdownOnly ? 'Show all files' : 'Show markdown files only'"
    :class="showMarkdownOnly ? 'text-foreground' : 'text-muted-foreground'"
    @click="showMarkdownOnly = !showMarkdownOnly"
  >
    <FileTextIcon class="size-3.5" />
  </Button>
  <Button
    variant="ghost"
    size="icon-xs"
    aria-label="Search files"
    @click="openWithFileSearch"
  >
    <SearchIcon class="size-3.5" />
  </Button>
</div>
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/blaisetiong/Developer/v2/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue
git commit -m "feat(file-explorer): add markdown-only filter toggle to sidebar"
```

---

## Task 4: Create MarkdownPreview component

**Files:**
- Create: `frontend/src/modules/file-explorer/components/MarkdownPreview.vue`

- [ ] **Step 1: Create the component**

Create `frontend/src/modules/file-explorer/components/MarkdownPreview.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const props = defineProps<{
  content: string;
}>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
}).enable("table");

const rendered = computed(() =>
  DOMPurify.sanitize(md.render(props.content)),
);
</script>

<template>
  <div class="markdown-preview min-h-0 flex-1 overflow-auto px-6 py-4" v-html="rendered" />
</template>

<style scoped>
.markdown-preview :deep(h1) { @apply text-2xl font-bold mt-6 mb-3 pb-1 border-b border-border; }
.markdown-preview :deep(h2) { @apply text-xl font-semibold mt-5 mb-2 pb-1 border-b border-border; }
.markdown-preview :deep(h3) { @apply text-lg font-semibold mt-4 mb-2; }
.markdown-preview :deep(h4) { @apply text-base font-semibold mt-3 mb-1; }
.markdown-preview :deep(p) { @apply my-3 leading-relaxed text-sm; }
.markdown-preview :deep(ul) { @apply my-3 ml-5 list-disc text-sm; }
.markdown-preview :deep(ol) { @apply my-3 ml-5 list-decimal text-sm; }
.markdown-preview :deep(li) { @apply my-1; }
.markdown-preview :deep(a) { @apply text-primary underline underline-offset-2; }
.markdown-preview :deep(blockquote) { @apply border-l-4 border-border pl-4 my-3 text-muted-foreground italic text-sm; }
.markdown-preview :deep(code) { @apply bg-muted text-foreground rounded px-1 py-0.5 text-[0.8rem] font-mono; }
.markdown-preview :deep(pre) { @apply bg-muted rounded-md p-4 my-3 overflow-x-auto text-sm; }
.markdown-preview :deep(pre code) { @apply bg-transparent p-0; }
.markdown-preview :deep(hr) { @apply border-border my-6; }
.markdown-preview :deep(img) { @apply max-w-full rounded-md my-3; }
.markdown-preview :deep(table) { @apply w-full text-sm my-3 border-collapse; }
.markdown-preview :deep(th) { @apply border border-border px-3 py-1.5 text-left font-semibold bg-muted; }
.markdown-preview :deep(td) { @apply border border-border px-3 py-1.5; }
.markdown-preview :deep(tr:nth-child(even) td) { @apply bg-muted/40; }
</style>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/blaisetiong/Developer/v2/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/file-explorer/components/MarkdownPreview.vue
git commit -m "feat(file-explorer): add MarkdownPreview component"
```

---

## Task 5: Add preview toggle to FileTabList

**Files:**
- Modify: `frontend/src/modules/file-explorer/components/FileTabList.vue`

- [ ] **Step 1: Add `EyeIcon` and `CodeIcon` to imports**

Find:

```ts
import {
  XIcon,
  SaveIcon,
  LoaderIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "@lucide/vue";
```

Replace with:

```ts
import {
  XIcon,
  SaveIcon,
  LoaderIcon,
  EyeIcon,
  CodeIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "@lucide/vue";
```

- [ ] **Step 2: Add `markdownPreview` prop and `toggleMarkdownPreview` emit**

Find:

```ts
const props = defineProps<{
  tabs: string[];
  activePath: string | null;
  dirtyPaths?: Set<string>;
  isSaving?: boolean;
  treeCollapsed?: boolean;
}>();
```

Replace with:

```ts
const props = defineProps<{
  tabs: string[];
  activePath: string | null;
  dirtyPaths?: Set<string>;
  isSaving?: boolean;
  treeCollapsed?: boolean;
  markdownPreview?: boolean;
}>();
```

Find:

```ts
const emit = defineEmits<{
  select: [relativePath: string];
  close: [relativePath: string];
  save: [];
  toggleTree: [];
}>();
```

Replace with:

```ts
const emit = defineEmits<{
  select: [relativePath: string];
  close: [relativePath: string];
  save: [];
  toggleTree: [];
  toggleMarkdownPreview: [];
}>();
```

- [ ] **Step 3: Add `isMarkdownActive` computed**

After the `canSave` computed, add:

```ts
const isMarkdownActive = computed(
  () => props.activePath != null && props.activePath.endsWith(".md"),
);
```

- [ ] **Step 4: Add the preview toggle button in the template**

Find in the template:

```html
    <Button
      variant="ghost"
      size="icon-xs"
      :aria-label="treeCollapsed ? 'Expand file tree' : 'Collapse file tree'"
      class="text-muted-foreground"
      @click="emit('toggleTree')"
    >
```

Insert the following block directly before it:

```html
    <Button
      v-if="isMarkdownActive"
      variant="ghost"
      size="icon-xs"
      :aria-label="markdownPreview ? 'Switch to editor' : 'Switch to preview'"
      :class="markdownPreview ? 'text-foreground' : 'text-muted-foreground'"
      @click="emit('toggleMarkdownPreview')"
    >
      <EyeIcon v-if="!markdownPreview" class="size-3.5" />
      <CodeIcon v-else class="size-3.5" />
    </Button>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/blaisetiong/Developer/v2/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/file-explorer/components/FileTabList.vue
git commit -m "feat(file-tab-list): add markdown preview toggle button"
```

---

## Task 6: Wire preview into FileExplorerPanel

**Files:**
- Modify: `frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue`

- [ ] **Step 1: Import `MarkdownPreview`**

Add to the import block in `FileExplorerPanel.vue` (alongside `CodeMirrorEditor`):

```ts
import MarkdownPreview from "@/modules/file-explorer/components/MarkdownPreview.vue";
```

- [ ] **Step 2: Add `markdownPreview` ref and reset watch**

After the `treeCollapsed = ref(false)` line, add:

```ts
const markdownPreview = ref(false);
```

After the existing `watch(selectedRelativePath, ...)` block, add:

```ts
watch(selectedRelativePath, (path) => {
  if (!path?.endsWith(".md")) markdownPreview.value = false;
});
```

- [ ] **Step 3: Pass props and emit to FileTabList**

Find in the template:

```html
<FileTabList
  :tabs="openFileTabs"
  :active-path="selectedRelativePath"
  :dirty-paths="dirtyPaths"
  :is-saving="isSaving"
  :tree-collapsed="treeCollapsed"
  @select="openFileInTab"
  @close="closeFileTabHandler"
  @save="handleSaveFromTab"
  @toggle-tree="toggleTree"
/>
```

Replace with:

```html
<FileTabList
  :tabs="openFileTabs"
  :active-path="selectedRelativePath"
  :dirty-paths="dirtyPaths"
  :is-saving="isSaving"
  :tree-collapsed="treeCollapsed"
  :markdown-preview="markdownPreview"
  @select="openFileInTab"
  @close="closeFileTabHandler"
  @save="handleSaveFromTab"
  @toggle-tree="toggleTree"
  @toggle-markdown-preview="markdownPreview = !markdownPreview"
/>
```

- [ ] **Step 4: Replace `CodeMirrorEditor` with conditional render**

Find in the template:

```html
<CodeMirrorEditor
  v-else
  ref="editorRef"
  :file-path="fileContent.path"
  :content="fileContent.content"
  class="min-h-0 flex-1"
  @save="handleEditorSave"
  @change="handleEditorChange"
/>
```

Replace with:

```html
<MarkdownPreview
  v-else-if="markdownPreview"
  :content="fileContent.content"
/>
<CodeMirrorEditor
  v-else
  ref="editorRef"
  :file-path="fileContent.path"
  :content="fileContent.content"
  class="min-h-0 flex-1"
  @save="handleEditorSave"
  @change="handleEditorChange"
/>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/blaisetiong/Developer/v2/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/file-explorer/pages/FileExplorerPanel.vue
git commit -m "feat(file-explorer): wire markdown preview toggle into editor panel"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/blaisetiong/Developer/v2/frontend
npm run dev
```

- [ ] **Step 2: Test markdown filter toggle**
  1. Open the file explorer sidebar
  2. Click the `FileTextIcon` button — tree should show `.md` files only, button highlights
  3. Refresh the page — filter state should persist (localStorage)
  4. Click again — all files restored

- [ ] **Step 3: Test markdown preview toggle**
  1. Open a `.md` file — preview toggle button (`EyeIcon`) appears in the tab bar
  2. Click it — rendered markdown preview shown (tables, headings, code blocks styled)
  3. Click `CodeIcon` — editor restored
  4. Switch to a non-`.md` file — toggle button disappears, no preview state leaked
  5. Switch back to `.md` file — toggle is off (reset on navigation)
