<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDebounceFn } from "@vueuse/core";
import { FileIcon, FileTextIcon, FolderTreeIcon, SearchIcon } from "@lucide/vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { FileTree } from "@pierre/trees";
import {
  fileContentQueryOptions,
  fileTreeQueryOptions,
} from "@/modules/file-explorer/queries";
import { gitStatusQueryOptions, type GitStatusEntry } from "@/modules/git/queries";
import {
  invalidateWorkspaceFs,
  worktreeQueryOptions,
} from "@/modules/workspace/queries";
import CodeMirrorEditor from "@/modules/file-explorer/components/CodeMirrorEditor.vue";
import FileTabList from "@/modules/file-explorer/components/FileTabList.vue";
import MarkdownPreview from "@/modules/file-explorer/components/MarkdownPreview.vue";
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
import { useExplorerContextQueueBridge } from "@/modules/file-explorer/hooks/use-explorer-context-queue-bridge";
import {
  contextQueueAnnotationsKey,
  contextQueueKey,
} from "@/modules/context-queue/lib/context-queue-keys";
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
import { Button } from "@/components/ui/button";
import { openWithFileSearch } from "@/modules/command-palette/useCommandPalette";

const props = defineProps<{
  worktreeId: string;
}>();

const contextQueue = inject(contextQueueKey, null);
const annotationState = inject(contextQueueAnnotationsKey, null);

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();

const explorerState = useFileExplorerStorage(() => props.worktreeId);
const { save, isSaving } = useFileEditorSave(() => props.worktreeId);

const showMarkdownOnly = computed({
  get: () => explorerState.value.markdownOnly ?? false,
  set: (val: boolean) => {
    explorerState.value = { ...explorerState.value, markdownOnly: val };
  },
});

const markdownPreview = computed({
  get: () => explorerState.value.markdownPreview ?? false,
  set: (val: boolean) => {
    explorerState.value = { ...explorerState.value, markdownPreview: val };
  },
});

const treeEl = ref<HTMLElement | null>(null);
const treePanelRef = ref<{ collapse: () => void; expand: () => void } | null>(null);
const treeCollapsed = ref(false);
const editorRef = ref<{ triggerSave: () => void } | null>(null);
const selectionReady = ref(false);
const syncingTreeSelection = ref(false);
let tree: InstanceType<typeof FileTree> | null = null;
let treeSubscription: (() => void) | null = null;

// Dirty state: set of relative paths with unsaved changes
const dirtyPaths = ref<Set<string>>(new Set());

// Discard dialog state
const discardDialogOpen = ref(false);
let pendingNavigatePath: string | null = null;
let pendingCloseTabPath: string | null = null;

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

const filteredPaths = computed(() => {
  const all = paths.value;
  if (!all) return null;
  if (!showMarkdownOnly.value) return all;
  return all.filter((p) => p.endsWith(".md"));
});

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

const showMarkdownPreview = computed(
  () =>
    markdownPreview.value &&
    (selectedRelativePath.value?.endsWith(".md") ?? false),
);

useExplorerContextQueueBridge({
  annotationState,
  contextQueue,
  relativePath: selectedRelativePath,
  worktreePath: () => worktree.value?.path,
  fileQuery: () =>
    typeof route.query.file === "string" ? route.query.file : undefined,
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
  if (active && active !== relativePath && dirtyPaths.value.has(active) && !isSaving.value) {
    pendingNavigatePath = relativePath;
    discardDialogOpen.value = true;
    return;
  }
  doOpenFileInTab(relativePath);
}

function doCloseTab(relativePath: string) {
  const current = openFileTabs.value;
  const next = closeFileTab(explorerState.value.openFiles, relativePath);
  persistOpenFiles(next);
  const newDirty = new Set(dirtyPaths.value);
  newDirty.delete(relativePath);
  dirtyPaths.value = newDirty;

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

function closeFileTabHandler(relativePath: string) {
  if (dirtyPaths.value.has(relativePath)) {
    pendingCloseTabPath = relativePath;
    discardDialogOpen.value = true;
    return;
  }
  doCloseTab(relativePath);
}

function onDiscardConfirm() {
  discardDialogOpen.value = false;

  if (pendingCloseTabPath) {
    const pathToClose = pendingCloseTabPath;
    pendingCloseTabPath = null;
    doCloseTab(pathToClose);
    return;
  }

  if (pendingNavigatePath) {
    const active = selectedRelativePath.value;
    if (active) {
      const next = new Set(dirtyPaths.value);
      next.delete(active);
      dirtyPaths.value = next;
    }
    doOpenFileInTab(pendingNavigatePath);
    pendingNavigatePath = null;
  }
}

function onDiscardCancel() {
  discardDialogOpen.value = false;
  pendingNavigatePath = null;
  pendingCloseTabPath = null;
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

function pathsListEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function mountTree(newPaths: string[]) {
  if (!treeEl.value || !Array.isArray(newPaths)) return;

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

function syncTreeToPaths(pathList: string[], prevPathList?: readonly string[] | null) {
  if (!treeEl.value) return;
  if (tree && prevPathList && pathsListEqual(pathList, prevPathList)) return;
  if (tree) teardownTree();
  void nextTick(() => mountTree(pathList));
}

function tryMountTree() {
  const newPaths = filteredPaths.value;
  if (!newPaths) return;
  if (tree) return;
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
  [filteredPaths, treeEl],
  ([pathList], [prevPathList]) => {
    if (!pathList) return;
    if (!tree) {
      tryMountTree();
      return;
    }
    syncTreeToPaths(pathList, prevPathList ?? null);
  },
  { flush: "post" },
);

watch(showMarkdownOnly, () => {
  const pathList = filteredPaths.value;
  if (!pathList) return;
  syncTreeToPaths(pathList);
});

watch(selectedRelativePath, (path) => {
  if (path) persistLastFile(path);
  revealActiveFileInTree();
}, { immediate: true });

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
    dirtyPaths.value = new Set();
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

onMounted(() => {
  void invalidateWorkspaceFs(queryClient, props.worktreeId);
});

onUnmounted(() => {
  teardownTree();
});

async function handleEditorSave(filePath: string, content: string) {
  const ok = await save(filePath, content);
  if (ok) {
    const next = new Set(dirtyPaths.value);
    next.delete(filePath);
    dirtyPaths.value = next;
  }
}

function handleEditorChange(isDirty: boolean) {
  const path = selectedRelativePath.value;
  if (!path) return;
  const next = new Set(dirtyPaths.value);
  if (isDirty) {
    next.add(path);
  } else {
    next.delete(path);
  }
  dirtyPaths.value = next;
}

function handleSaveFromTab() {
  editorRef.value?.triggerSave();
}

function toggleTree() {
  const panel = treePanelRef.value;
  if (!panel) return;
  if (treeCollapsed.value) {
    panel.expand();
  } else {
    panel.collapse();
  }
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
        <div class="relative flex h-full min-h-0 flex-col">
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
            <MarkdownPreview
              v-else-if="showMarkdownPreview"
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
        ref="treePanelRef"
        :default-size="treeDefaultSize"
        :min-size="FILE_EXPLORER_MIN_TREE_SIZE"
        :max-size="FILE_EXPLORER_MAX_TREE_SIZE"
        collapsible
        :collapsed-size="0"
        @collapse="treeCollapsed = true"
        @expand="treeCollapsed = false"
      >
        <div class="flex h-full min-h-0 flex-col">
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
          <div
            ref="treeEl"
            class="trees-shadcn min-h-0 flex-1 overflow-auto px-1 pb-1"
          />
        </div>
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
