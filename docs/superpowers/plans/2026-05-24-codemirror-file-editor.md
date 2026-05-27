# CodeMirror File Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only `@pierre/diffs` CodeView in the file explorer with a CodeMirror 6 editor that supports full file editing, Cmd+S save-to-disk, and dirty-state tab indicators.

**Architecture:** CM6 `EditorView` is owned by a `CodeMirrorEditor.vue` component that replaces `FilePreviewCodeView.vue`. A new `PUT /worktrees/:id/files/content` server endpoint writes files to disk. Dirty state is tracked in `FileExplorerPanel.vue` and surfaced as a dot on the tab in `FileTabList.vue`.

**Tech Stack:** CodeMirror 6 (`@codemirror/*`), Vue 3 Composition API, TanStack Query v5, Hono, Zod, vue-sonner

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `server/schemas/workspace.ts` | Add `writeFileBodySchema` |
| Modify | `server/modules/workspace/files.ts` | Add `writeFileForWorktree` |
| Modify | `server/modules/workspace/router.ts` | Register `PUT /worktrees/:id/files/content` |
| Create | `src/modules/file-explorer/lib/detect-language.ts` | Extension → CM6 language map |
| Create | `src/modules/file-explorer/lib/detect-language.test.ts` | Unit tests for language detection |
| Create | `src/modules/file-explorer/hooks/use-file-editor-save.ts` | Save mutation composable |
| Create | `src/modules/file-explorer/components/CodeMirrorEditor.vue` | CM6 `EditorView` wrapper |
| Modify | `src/modules/file-explorer/components/FileTabList.vue` | Dirty-dot indicator |
| Modify | `src/modules/file-explorer/pages/FileExplorerPanel.vue` | Wire editor, save, dirty, discard dialog |

---

## Task 1: Install CodeMirror packages

**Files:** `package.json`

- [ ] **Step 1: Install CM6 packages**

```bash
npm install @codemirror/view @codemirror/state @codemirror/commands @codemirror/language @codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-json @codemirror/lang-css @codemirror/lang-html @codemirror/lang-markdown @codemirror/theme-one-dark
```

Expected: packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify TypeScript can see the types**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors from CodeMirror (there may be pre-existing errors — ignore those).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install codemirror 6 packages"
```

---

## Task 2: Server — write file endpoint

**Files:**
- Modify: `server/schemas/workspace.ts`
- Modify: `server/modules/workspace/files.ts`
- Modify: `server/modules/workspace/router.ts`

- [ ] **Step 1: Add write schema to `server/schemas/workspace.ts`**

Add this export at the end of the file:

```ts
export const writeFileBodySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
```

- [ ] **Step 2: Add `writeFileForWorktree` to `server/modules/workspace/files.ts`**

Add this import at the top of the file (after the existing `import { open, readdir, stat } from "node:fs/promises"`):

```ts
import { writeFile } from "node:fs/promises";
```

Then add this function at the end of the file:

```ts
export async function writeFileForWorktree(
  worktreePath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/")) {
    throw new FileReadError("Invalid file path", 400);
  }

  const absolutePath = assertPathWithinRoot(worktreePath, normalized);

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch {
    throw new FileReadError("File not found", 404);
  }

  if (!fileStat.isFile()) {
    throw new FileReadError("Not a file", 400);
  }

  await writeFile(absolutePath, content, "utf-8");
}
```

- [ ] **Step 3: Register the route in `server/modules/workspace/router.ts`**

First, add `writeFileBodySchema` to the import from `../../schemas/workspace.js`:

```ts
import {
  createWorktreeBodySchema,
  createTerminalBodySchema,
  gitCommitBodySchema,
  gitFileActionsBodySchema,
  registerProjectBodySchema,
  updateTerminalBodySchema,
  writeFileBodySchema,
} from "../../schemas/workspace.js";
```

Then add `writeFileForWorktree` to the import from `./files.js`:

```ts
import { FileReadError, listFilesForWorktree, readFileForWorktree, writeFileForWorktree } from "./files.js";
```

Then add this route after the existing `.get("/worktrees/:id/files/content", ...)` handler (around line 188):

```ts
    .put(
      "/worktrees/:id/files/content",
      zValidator("json", writeFileBodySchema),
      async (c) => {
        const worktree = await getWorktree(db, c.req.param("id"));
        if (!worktree) return c.json({ error: "Worktree not found" }, 404);
        const { path, content } = c.req.valid("json");
        try {
          await writeFileForWorktree(worktree.path, path, content);
          return c.json({ ok: true as const });
        } catch (err) {
          if (err instanceof FileReadError) {
            return c.json({ error: err.message }, err.status);
          }
          throw err;
        }
      },
    )
```

- [ ] **Step 4: Verify server compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add server/schemas/workspace.ts server/modules/workspace/files.ts server/modules/workspace/router.ts
git commit -m "feat: add PUT /worktrees/:id/files/content endpoint"
```

---

## Task 3: Language detection helper

**Files:**
- Create: `src/modules/file-explorer/lib/detect-language.ts`
- Create: `src/modules/file-explorer/lib/detect-language.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/file-explorer/lib/detect-language.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectLanguage } from "./detect-language.js";

describe("detectLanguage", () => {
  it("detects TypeScript files", () => {
    const result = detectLanguage("src/index.ts");
    expect(result).not.toBeNull();
  });

  it("detects TSX files", () => {
    expect(detectLanguage("src/App.tsx")).not.toBeNull();
  });

  it("detects JavaScript files", () => {
    expect(detectLanguage("scripts/build.js")).not.toBeNull();
  });

  it("detects Python files", () => {
    expect(detectLanguage("main.py")).not.toBeNull();
  });

  it("detects JSON files", () => {
    expect(detectLanguage("package.json")).not.toBeNull();
  });

  it("detects CSS files", () => {
    expect(detectLanguage("styles.css")).not.toBeNull();
  });

  it("detects HTML files", () => {
    expect(detectLanguage("index.html")).not.toBeNull();
  });

  it("detects Markdown files", () => {
    expect(detectLanguage("README.md")).not.toBeNull();
  });

  it("returns null for unknown extensions", () => {
    expect(detectLanguage("binary.wasm")).toBeNull();
    expect(detectLanguage("no-extension")).toBeNull();
  });

  it("handles nested paths correctly", () => {
    expect(detectLanguage("src/deep/nested/file.ts")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/modules/file-explorer/lib/detect-language.test.ts
```

Expected: FAIL — `Cannot find module './detect-language.js'`

- [ ] **Step 3: Implement `detect-language.ts`**

Create `src/modules/file-explorer/lib/detect-language.ts`:

```ts
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import type { LanguageSupport } from "@codemirror/language";

export function detectLanguage(filePath: string): LanguageSupport | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return javascript({ typescript: true, jsx: ext === "tsx" });
    case "js":
    case "jsx":
      return javascript({ jsx: ext === "jsx" });
    case "py":
      return python();
    case "json":
      return json();
    case "css":
      return css();
    case "html":
      return html();
    case "md":
    case "mdx":
      return markdown();
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/modules/file-explorer/lib/detect-language.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/file-explorer/lib/detect-language.ts src/modules/file-explorer/lib/detect-language.test.ts
git commit -m "feat: add detectLanguage helper for CodeMirror"
```

---

## Task 4: Save mutation composable

**Files:**
- Create: `src/modules/file-explorer/hooks/use-file-editor-save.ts`

- [ ] **Step 1: Create the composable**

Create `src/modules/file-explorer/hooks/use-file-editor-save.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";
import { toast } from "vue-sonner";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import { workspaceKeys } from "@/modules/workspace/queries/keys";

export function useFileEditorSave(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].files.content.$put({
        param: { id },
        json: { path, content },
      });
      await ensureOk<{ ok: true }>(res);
    },
    onSuccess: (_data, { path }) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.fileContent(toValue(worktreeId), path),
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save file");
    },
  });

  async function save(path: string, content: string): Promise<boolean> {
    try {
      await mutateAsync({ path, content });
      return true;
    } catch {
      return false;
    }
  }

  return { save, isSaving: isPending, saveError: error };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/file-explorer/hooks/use-file-editor-save.ts
git commit -m "feat: add useFileEditorSave composable"
```

---

## Task 5: CodeMirrorEditor component

**Files:**
- Create: `src/modules/file-explorer/components/CodeMirrorEditor.vue`

- [ ] **Step 1: Create the component**

Create `src/modules/file-explorer/components/CodeMirrorEditor.vue`:

```vue
<script setup lang="ts">
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { onBeforeUnmount, onMounted, watch } from "vue";
import { ref } from "vue";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";
import { detectLanguage } from "@/modules/file-explorer/lib/detect-language";

const props = defineProps<{
  filePath: string;
  content: string;
}>();

const emit = defineEmits<{
  save: [filePath: string, content: string];
  change: [];
}>();

const containerRef = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
const { colorMode } = useAppColorMode();

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();

/** Set to true during programmatic document resets to suppress the "change" emit. */
let resetting = false;

const lightTheme = EditorView.theme(
  {
    "&": { background: "transparent", color: "var(--foreground)" },
    ".cm-content": { caretColor: "var(--foreground)", fontFamily: "var(--font-app-mono)", fontSize: "12px" },
    ".cm-cursor": { borderLeftColor: "var(--foreground)" },
    ".cm-gutters": { background: "transparent", borderRight: "1px solid var(--border)", color: "var(--muted-foreground)" },
    ".cm-activeLineGutter": { background: "var(--muted)" },
    ".cm-activeLine": { background: "color-mix(in srgb, var(--muted) 40%, transparent)" },
    ".cm-selectionBackground, ::selection": { background: "var(--accent) !important" },
  },
  { dark: false },
);

function buildThemeExtension(dark: boolean) {
  return dark
    ? [oneDark]
    : [lightTheme, syntaxHighlighting(defaultHighlightStyle, { fallback: true })];
}

function buildLanguageExtension(filePath: string) {
  const lang = detectLanguage(filePath);
  return lang ? [lang] : [];
}

function createState(content: string): EditorState {
  const dark = colorMode.value === "dark";
  return EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      keymap.of([
        { key: "Mod-s", run: () => { handleSave(); return true; } },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
      ]),
      themeCompartment.of(buildThemeExtension(dark)),
      languageCompartment.of(buildLanguageExtension(props.filePath)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !resetting) {
          emit("change");
        }
      }),
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": {
          overflow: "auto",
          scrollbarWidth: "thin",
          fontFamily: "var(--font-app-mono)",
          fontSize: "12px",
        },
      }),
    ],
  });
}

function handleSave() {
  if (!view) return;
  emit("save", props.filePath, view.state.doc.toString());
}

function mountEditor() {
  const container = containerRef.value;
  if (!container || view) return;
  view = new EditorView({
    state: createState(props.content),
    parent: container,
  });
}

function resetDocument(newContent: string, newFilePath: string) {
  if (!view) return;
  resetting = true;
  try {
    // Replace document content and reconfigure language — does NOT discard base extensions.
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newContent },
      selection: { anchor: 0 },
      effects: [
        languageCompartment.reconfigure(buildLanguageExtension(newFilePath)),
      ],
      scrollIntoView: true,
    });
  } finally {
    resetting = false;
  }
}

onMounted(() => {
  mountEditor();
});

// Single watcher covering both filePath and content changes.
// When filePath changes the language reconfigures immediately;
// when content arrives from the query it resets the document.
watch(
  [() => props.filePath, () => props.content],
  ([newPath, newContent]) => {
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc === newContent) {
      // Content is the same — only reconfigure language if path changed.
      view.dispatch({
        effects: languageCompartment.reconfigure(buildLanguageExtension(newPath)),
      });
    } else {
      resetDocument(newContent, newPath);
    }
  },
);

watch(colorMode, (mode) => {
  if (!view) return;
  view.dispatch({
    effects: themeCompartment.reconfigure(buildThemeExtension(mode === "dark")),
  });
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      ref="containerRef"
      class="code-mirror-editor min-h-0 flex-1"
    />
  </div>
</template>

<style>
.code-mirror-editor {
  contain: strict;
}

.code-mirror-editor .cm-editor {
  height: 100%;
}

.code-mirror-editor .cm-editor.cm-focused {
  outline: none;
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors from `CodeMirrorEditor.vue`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/file-explorer/components/CodeMirrorEditor.vue
git commit -m "feat: add CodeMirrorEditor component"
```

---

## Task 6: FileTabList dirty-dot indicator

**Files:**
- Modify: `src/modules/file-explorer/components/FileTabList.vue`

- [ ] **Step 1: Add `dirtyPaths` prop and dirty dot to `FileTabList.vue`**

Replace the entire content of `FileTabList.vue` with:

```vue
<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { XIcon } from "@lucide/vue";
import { cn } from "@/lib/utils";
import { basename } from "@/modules/file-explorer/lib/file-tabs";
import FileTabIcon from "@/modules/file-explorer/components/FileTabIcon.vue";

const props = defineProps<{
  tabs: string[];
  activePath: string | null;
  dirtyPaths?: Set<string>;
}>();

const tabListEl = ref<HTMLElement | null>(null);

watch(
  () => props.activePath,
  async (activePath) => {
    if (!activePath) return;
    await nextTick();
    const el = tabListEl.value?.querySelector<HTMLElement>(
      `[data-file-tab-path="${CSS.escape(activePath)}"]`,
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
  { flush: "post" },
);

const emit = defineEmits<{
  select: [relativePath: string];
  close: [relativePath: string];
}>();

function tabClass(relativePath: string) {
  const isActive = relativePath === props.activePath;
  return cn(
    "group inline-flex h-7 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] leading-none transition-colors",
    isActive
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
      : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  );
}

function closeClass(relativePath: string) {
  const isActive = relativePath === props.activePath;
  return cn(
    "ml-0.5 shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-foreground/10",
    isActive ? "opacity-60" : "group-hover:opacity-60",
  );
}
</script>

<template>
  <div
    v-if="tabs.length > 0"
    ref="tabListEl"
    class="flex min-h-9 shrink-0 items-center gap-1 overflow-x-auto px-2 py-1"
    role="tablist"
    aria-label="Open files"
  >
    <button
      v-for="relativePath in tabs"
      :key="relativePath"
      type="button"
      role="tab"
      :class="tabClass(relativePath)"
      :data-file-tab-path="relativePath"
      :aria-selected="relativePath === activePath"
      :aria-current="relativePath === activePath ? 'page' : undefined"
      :title="relativePath"
      @click="emit('select', relativePath)"
    >
      <FileTabIcon :relative-path="relativePath" />
      <span class="relative min-w-0 truncate">
        {{ basename(relativePath) }}
        <span
          v-if="dirtyPaths?.has(relativePath)"
          class="ml-1 inline-block size-1.5 rounded-full bg-current opacity-60"
          aria-label="unsaved changes"
        />
      </span>
      <span
        role="button"
        :class="closeClass(relativePath)"
        :aria-label="`Close ${basename(relativePath)}`"
        @click.stop="emit('close', relativePath)"
      >
        <XIcon class="size-3" />
      </span>
    </button>
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/file-explorer/components/FileTabList.vue
git commit -m "feat: add dirty-dot indicator to FileTabList"
```

---

## Task 7: Wire everything in FileExplorerPanel

**Files:**
- Modify: `src/modules/file-explorer/pages/FileExplorerPanel.vue`

This is the largest change. It wires `CodeMirrorEditor`, `useFileEditorSave`, dirty state, the discard dialog, and removes `FilePreviewCodeView`.

- [ ] **Step 1: Replace `FileExplorerPanel.vue`**

Replace the entire content with:

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDebounceFn } from "@vueuse/core";
import { FileIcon, FolderTreeIcon } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { FileTree } from "@pierre/trees";
import {
  fileContentQueryOptions,
  fileTreeQueryOptions,
} from "@/modules/file-explorer/queries";
import { gitStatusQueryOptions, type GitStatusEntry } from "@/modules/git/queries";
import { worktreeQueryOptions } from "@/modules/workspace/queries";
import CodeMirrorEditor from "@/modules/file-explorer/components/CodeMirrorEditor.vue";
import FileTabList from "@/modules/file-explorer/components/FileTabList.vue";
import {
  adjacentFileAfterClose,
  closeFileTab,
  openFileTab,
  pruneOpenFiles,
  seedOpenFiles,
} from "@/modules/file-explorer/lib/file-tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ancestorDirectoryPaths,
  clampFileExplorerTreeSize,
  FILE_EXPLORER_DEFAULT_TREE_SIZE,
  FILE_EXPLORER_MAX_TREE_SIZE,
  FILE_EXPLORER_MIN_TREE_SIZE,
  mergeExpandedPaths,
  useFileExplorerStorage,
} from "@/modules/file-explorer/lib/file-explorer-storage";
import { useFileEditorSave } from "@/modules/file-explorer/hooks/use-file-editor-save";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();

const explorerState = useFileExplorerStorage(() => props.worktreeId);
const { save, isSaving } = useFileEditorSave(() => props.worktreeId);

const treeEl = ref<HTMLElement | null>(null);
const selectionReady = ref(false);
const syncingTreeSelection = ref(false);
let tree: InstanceType<typeof FileTree> | null = null;
let treeSubscription: (() => void) | null = null;

// Dirty state: set of relative paths with unsaved changes
const dirtyPaths = ref<Set<string>>(new Set());

// Discard dialog state
const discardDialogOpen = ref(false);
let pendingNavigatePath: string | null = null;

const treeDefaultSize = computed(() =>
  clampFileExplorerTreeSize(
    explorerState.value.treeSize ?? FILE_EXPLORER_DEFAULT_TREE_SIZE,
  ),
);
const previewDefaultSize = computed(() => 100 - treeDefaultSize.value);

const persistTreeSize = useDebounceFn((size: number) => {
  explorerState.value = {
    ...explorerState.value,
    treeSize: clampFileExplorerTreeSize(size),
  };
}, 300);

function onSplitLayout(sizes: number[]) {
  const treeSize = sizes[1];
  if (typeof treeSize === "number" && Number.isFinite(treeSize)) {
    persistTreeSize(treeSize);
  }
}

const { data: worktree } = useQuery(worktreeQueryOptions(() => props.worktreeId));
const { data: paths } = useQuery(fileTreeQueryOptions(() => props.worktreeId));
const { data: gitStatus } = useQuery(gitStatusQueryOptions(() => props.worktreeId));

const selectedRelativePath = computed(() => {
  const encoded = route.query.file;
  if (typeof encoded !== "string" || !encoded) return null;
  const worktreePath = worktree.value?.path;
  if (!worktreePath) return null;
  const fullPath = decodeURIComponent(encoded);
  const prefix = worktreePath.endsWith("/") ? worktreePath : `${worktreePath}/`;
  if (!fullPath.startsWith(prefix)) return null;
  return fullPath.slice(prefix.length);
});

const openFileTabs = computed(() =>
  seedOpenFiles(explorerState.value.openFiles, explorerState.value.lastFilePath),
);

function persistOpenFiles(nextOpenFiles: string[], lastFilePath?: string) {
  explorerState.value = {
    ...explorerState.value,
    openFiles: nextOpenFiles,
    ...(lastFilePath !== undefined ? { lastFilePath } : {}),
  };
}

function navigateToFile(relativePath: string) {
  if (!worktree.value?.path) return;
  router.replace({
    query: {
      ...route.query,
      file: encodeURIComponent(getFullPath(relativePath)),
    },
  });
}

function doOpenFileInTab(relativePath: string) {
  if (!isPreviewableFile(relativePath)) return;
  const next = openFileTab(explorerState.value.openFiles, relativePath);
  persistOpenFiles(next, relativePath);
  persistLastFile(relativePath);
  navigateToFile(relativePath);
}

function openFileInTab(relativePath: string) {
  const active = selectedRelativePath.value;
  if (active && active !== relativePath && dirtyPaths.value.has(active)) {
    pendingNavigatePath = relativePath;
    discardDialogOpen.value = true;
    return;
  }
  doOpenFileInTab(relativePath);
}

function closeFileTabHandler(relativePath: string) {
  const current = openFileTabs.value;
  const next = closeFileTab(explorerState.value.openFiles, relativePath);
  persistOpenFiles(next);
  dirtyPaths.value.delete(relativePath);

  if (selectedRelativePath.value !== relativePath) return;

  const fallback = adjacentFileAfterClose(current, relativePath);
  if (fallback) {
    doOpenFileInTab(fallback);
    return;
  }
  const query = { ...route.query };
  delete query.file;
  router.replace({ query });
}

function onDiscardConfirm() {
  const active = selectedRelativePath.value;
  if (active) dirtyPaths.value.delete(active);
  discardDialogOpen.value = false;
  if (pendingNavigatePath) {
    doOpenFileInTab(pendingNavigatePath);
    pendingNavigatePath = null;
  }
}

function onDiscardCancel() {
  discardDialogOpen.value = false;
  pendingNavigatePath = null;
}

const {
  data: fileContent,
  isLoading: fileLoading,
  isError: fileError,
  error: fileErrorObj,
} = useQuery(
  fileContentQueryOptions(
    () => props.worktreeId,
    () => selectedRelativePath.value,
  ),
);

type PierreGitStatus = "added" | "modified" | "deleted" | "renamed" | "untracked" | "ignored";

function toPierreGitStatusEntries(
  entries: GitStatusEntry[],
): { path: string; status: PierreGitStatus }[] {
  const result: { path: string; status: PierreGitStatus }[] = [];
  for (const entry of entries) {
    const code = entry.staged ?? entry.unstaged;
    if (!code || code === "unknown" || code === "unmerged" || code === "copied") continue;
    if (
      code !== "added" &&
      code !== "modified" &&
      code !== "deleted" &&
      code !== "renamed" &&
      code !== "untracked" &&
      code !== "ignored"
    ) {
      continue;
    }
    result.push({ path: entry.path, status: code });
  }
  return result;
}

function getFullPath(relativePath: string): string {
  const base = worktree.value?.path ?? "";
  return `${base}/${relativePath}`;
}

function isPreviewableFile(relativePath: string): boolean {
  return paths.value?.includes(relativePath) ?? false;
}

function persistLastFile(relativePath: string) {
  const openFiles = openFileTab(explorerState.value.openFiles, relativePath);
  explorerState.value = {
    ...explorerState.value,
    lastFilePath: relativePath,
    openFiles,
    expandedPaths: mergeExpandedPaths(
      explorerState.value.expandedPaths,
      relativePath,
    ),
  };
}

function collectExpandedPathsFromDom(): string[] {
  const root = treeEl.value;
  if (!root) return explorerState.value.expandedPaths ?? [];
  const paths: string[] = [];
  root
    .querySelectorAll('[data-item-type="folder"][aria-expanded="true"]')
    .forEach((node) => {
      const path = node.getAttribute("data-item-path");
      if (path) paths.push(path);
    });
  return paths;
}

const persistExpandedPaths = useDebounceFn(() => {
  const paths = collectExpandedPathsFromDom();
  explorerState.value = {
    ...explorerState.value,
    expandedPaths: paths,
  };
}, 200);

function initialExpandedPaths(): string[] {
  return mergeExpandedPaths(
    explorerState.value.expandedPaths,
    explorerState.value.lastFilePath,
    selectedRelativePath.value,
  );
}

function restoreLastFileFromStorage() {
  const relativePath = explorerState.value.lastFilePath;
  if (!relativePath || route.query.file || !worktree.value?.path) return;
  const pathSet = paths.value;
  if (pathSet && !pathSet.includes(relativePath)) return;
  if (!explorerState.value.openFiles?.length) {
    persistOpenFiles(seedOpenFiles(undefined, relativePath), relativePath);
  }
  navigateToFile(relativePath);
}

function syncSelectionToUrl(selectedPaths: string[]) {
  if (!selectionReady.value || syncingTreeSelection.value) return;
  const selected = selectedPaths[0];
  const currentFile = route.query.file;
  if (selected) {
    if (!isPreviewableFile(selected)) return;
    const encoded = encodeURIComponent(getFullPath(selected));
    if (currentFile === encoded) return;
    openFileInTab(selected);
  } else if (currentFile !== undefined) {
    const query = { ...route.query };
    delete query.file;
    router.replace({ query });
  }
}

function expandAncestorsInTree(relativePath: string) {
  if (!tree) return;
  for (const ancestor of ancestorDirectoryPaths(relativePath)) {
    const item = tree.getItem(ancestor);
    if (item?.isDirectory() && !item.isExpanded()) {
      item.expand();
    }
  }
}

async function revealActiveFileInTree() {
  if (!tree) return;
  syncingTreeSelection.value = true;
  try {
    const relativePath = selectedRelativePath.value;
    for (const path of [...tree.getSelectedPaths()]) {
      if (path !== relativePath) {
        tree.getItem(path)?.deselect();
      }
    }
    if (!relativePath) return;

    const expandedPaths = mergeExpandedPaths(
      explorerState.value.expandedPaths,
      relativePath,
    );
    expandAncestorsInTree(relativePath);
    explorerState.value = {
      ...explorerState.value,
      expandedPaths,
    };

    await nextTick();
    tree.getItem(relativePath)?.select();
    tree.scrollToPath(relativePath, { offset: "nearest" });
  } finally {
    syncingTreeSelection.value = false;
  }
}

function teardownTree() {
  treeSubscription?.();
  treeSubscription = null;
  tree?.cleanUp();
  tree = null;
  selectionReady.value = false;
}

function mountTree(newPaths: string[]) {
  if (!treeEl.value || tree || !Array.isArray(newPaths)) return;

  tree = new FileTree({
    paths: newPaths,
    density: "compact",
    icons: "minimal",
    initialExpandedPaths: initialExpandedPaths(),
    onSelectionChange: syncSelectionToUrl,
    unsafeCSS: `
      [data-file-tree-virtualized-scroll='true'] {
        scrollbar-gutter: auto;
      }
    `,
  });
  tree.render({ fileTreeContainer: treeEl.value });

  treeSubscription = tree.subscribe(() => {
    persistExpandedPaths();
  });

  if (gitStatus.value?.files) {
    tree.setGitStatus(toPierreGitStatusEntries(gitStatus.value.files));
  }

  revealActiveFileInTree();
  selectionReady.value = true;
}

function tryMountTree() {
  const newPaths = paths.value;
  if (!newPaths) return;
  mountTree(newPaths);
}

watch(
  () => gitStatus.value,
  (status) => {
    if (!tree || !status) return;
    tree.setGitStatus(toPierreGitStatusEntries(status.files));
  },
);

watch(
  [() => paths.value, treeEl],
  () => {
    tryMountTree();
  },
  { flush: "post" },
);

watch(selectedRelativePath, (path) => {
  if (path) persistLastFile(path);
  revealActiveFileInTree();
});

watch(
  [openFileTabs, selectedRelativePath, () => paths.value],
  ([tabs, active]) => {
    if (tabs.length === 0 || active) return;
    const preferred = explorerState.value.lastFilePath ?? tabs[0];
    if (!preferred || !paths.value?.includes(preferred)) return;
    navigateToFile(preferred);
  },
  { immediate: true },
);

watch(
  () => [worktree.value?.path, paths.value, route.query.file] as const,
  () => {
    restoreLastFileFromStorage();
  },
  { immediate: true },
);

watch(
  () => props.worktreeId,
  (newId, oldId) => {
    if (!oldId || newId === oldId) return;
    teardownTree();
    dirtyPaths.value.clear();
  },
);

watch(
  () => paths.value,
  (pathList) => {
    if (!pathList) return;
    const pruned = pruneOpenFiles(explorerState.value.openFiles, new Set(pathList));
    if (pruned.length !== (explorerState.value.openFiles?.length ?? 0)) {
      persistOpenFiles(pruned);
    }
    if (
      selectedRelativePath.value &&
      !pathList.includes(selectedRelativePath.value)
    ) {
      closeFileTabHandler(selectedRelativePath.value);
    }
  },
);

onUnmounted(() => {
  teardownTree();
});

async function handleEditorSave(filePath: string, content: string) {
  const ok = await save(filePath, content);
  if (ok) {
    dirtyPaths.value.delete(filePath);
  }
}

function handleEditorChange() {
  const path = selectedRelativePath.value;
  if (!path) return;
  dirtyPaths.value.add(path);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div
      v-if="!paths"
      class="flex flex-1 items-center justify-center gap-3 p-6 text-center"
    >
      <FolderTreeIcon class="size-10 text-muted-foreground/50" />
      <p class="text-sm text-muted-foreground">Loading…</p>
    </div>

    <ResizablePanelGroup
      v-else
      :key="worktreeId"
      id="file-explorer-split"
      direction="horizontal"
      class="min-h-0 flex-1"
      @layout="onSplitLayout"
    >
      <ResizablePanel
        id="file-explorer-preview"
        :default-size="previewDefaultSize"
        :min-size="45"
      >
        <div class="flex h-full min-h-0 flex-col">
          <FileTabList
            :tabs="openFileTabs"
            :active-path="selectedRelativePath"
            :dirty-paths="dirtyPaths"
            @select="openFileInTab"
            @close="closeFileTabHandler"
          />
          <div v-if="!selectedRelativePath" class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <FileIcon class="size-8 opacity-40" />
            <p class="text-sm">Select a file to preview</p>
          </div>

          <div
            v-else-if="fileLoading"
            class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
          >
            Loading file…
          </div>

          <div
            v-else-if="fileError"
            class="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive"
          >
            {{ fileErrorObj instanceof Error ? fileErrorObj.message : "Could not load file" }}
          </div>

          <template v-else-if="fileContent">
            <p
              v-if="fileContent.truncated"
              class="shrink-0 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
            >
              Preview truncated — file exceeds size limit.
            </p>
            <CodeMirrorEditor
              v-else
              :file-path="fileContent.path"
              :content="fileContent.content"
              class="min-h-0 flex-1"
              @save="handleEditorSave"
              @change="handleEditorChange"
            />
            <div
              v-if="fileContent.truncated"
              class="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground"
            >
              Editing disabled for truncated files.
            </div>
          </template>

          <div
            v-if="isSaving"
            class="absolute bottom-2 right-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
          >
            Saving…
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle
        with-handle
        class="active:bg-muted data-[resize-handle-state=drag]:bg-muted active:[&_[data-slot=resize-grip]]:bg-muted data-[resize-handle-state=drag]:[&_[data-slot=resize-grip]]:bg-muted [&_[data-slot=resize-grip]]:bg-muted-foreground/25"
      />

      <ResizablePanel
        id="file-explorer-tree"
        :default-size="treeDefaultSize"
        :min-size="FILE_EXPLORER_MIN_TREE_SIZE"
        :max-size="FILE_EXPLORER_MAX_TREE_SIZE"
      >
        <div
          ref="treeEl"
          class="trees-shadcn h-full min-h-0 overflow-auto px-1 py-1"
        />
      </ResizablePanel>
    </ResizablePanelGroup>

    <AlertDialog :open="discardDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Discard them and switch files?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="onDiscardCancel">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="onDiscardConfirm">Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors from `FileExplorerPanel.vue`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/file-explorer/pages/FileExplorerPanel.vue
git commit -m "feat: wire CodeMirrorEditor into FileExplorerPanel with save and dirty state"
```

---

## Task 8: Smoke test in the browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open a project in the file explorer**

Navigate to the file explorer panel. Select a `.ts` or `.py` file.

Expected:
- CodeMirror editor renders with syntax highlighting
- Theme matches the current color mode (dark/light)
- Line numbers are visible

- [ ] **Step 3: Test editing and save**

Edit a line in the file. The tab should show a dot (dirty indicator).

Press Cmd+S (Mac) or Ctrl+S (Windows/Linux).

Expected:
- "Saving…" indicator appears briefly
- Dot disappears from the tab after save succeeds
- File contents on disk are updated

- [ ] **Step 4: Test discard dialog**

Edit a file, then click a different tab without saving.

Expected:
- AlertDialog appears asking "Unsaved changes"
- Clicking Cancel stays on the current file
- Clicking Discard switches to the other file and clears the dirty dot

- [ ] **Step 5: Test truncated files**

If a file exceeds the size limit (512 KB), it should show "Preview truncated" and "Editing disabled for truncated files" — no CodeMirror editor is rendered for it.

- [ ] **Step 6: Final commit if any last-minute fixes were needed**

```bash
git add -p
git commit -m "fix: address smoke test findings in file editor"
```

---

## Summary of all commits

1. `chore: install codemirror 6 packages`
2. `feat: add PUT /worktrees/:id/files/content endpoint`
3. `feat: add detectLanguage helper for CodeMirror`
4. `feat: add useFileEditorSave composable`
5. `feat: add CodeMirrorEditor component`
6. `feat: add dirty-dot indicator to FileTabList`
7. `feat: wire CodeMirrorEditor into FileExplorerPanel with save and dirty state`
8. *(optional)* `fix: address smoke test findings in file editor`
