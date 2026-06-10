<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDebounceFn } from "@vueuse/core";
import { FilePlusIcon, FileTextIcon, FolderPlusIcon, FolderTreeIcon, SearchIcon } from "@lucide/vue";
import IsoFileOpen from "@/assets/isocons/IsoFileOpen.vue";
import IsoClockLoader from "@/assets/isocons/IsoClockLoader.vue";
import IsoFileDownloadOff from "@/assets/isocons/IsoFileDownloadOff.vue";
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
import { useProjectIsGitRepo } from "@/modules/workspace/hooks/use-project-is-git-repo";
import CodeMirrorEditor from "@/modules/file-explorer/components/CodeMirrorEditor.vue";
import FileExplorerTreePanelBridge from "@/modules/file-explorer/components/FileExplorerTreePanelBridge.vue";
import FileTabList from "@/modules/file-explorer/components/FileTabList.vue";
import MarkdownPreview from "@/modules/file-explorer/components/MarkdownPreview.vue";
import ImagePreview from "@/modules/file-explorer/components/ImagePreview.vue";
import { getFilePreviewType } from "@/modules/file-explorer/lib/file-preview-type";
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
import type { FileTreeMoveEvent } from "@pierre/trees";
import {
  useCreateFile,
  useDeleteFile,
  useMoveFile,
} from "@/modules/file-explorer/hooks/use-file-mutations";
import { createFileContextMenu } from "@/modules/file-explorer/lib/file-context-menu";
import { Input } from "@/components/ui/input";

const props = defineProps<{
  worktreeId: string;
}>();

const contextQueue = inject(contextQueueKey, null);
const annotationState = inject(contextQueueAnnotationsKey, null);

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();

const ownsRoute = computed(() => route.name === "explorer");

const explorerState = useFileExplorerStorage(() => props.worktreeId);
const { save, isSaving } = useFileEditorSave(() => props.worktreeId);

const createFileMutation = useCreateFile(() => props.worktreeId);
const deleteFileMutation = useDeleteFile(() => props.worktreeId);
const moveFileMutation = useMoveFile(() => props.worktreeId);

// Delete dialog state
const deleteDialogOpen = ref(false);
const pendingDeletePaths = ref<{ path: string; isDir: boolean }[]>([]);

// New entry dialog state
const newEntryDialogOpen = ref(false);
const newEntryName = ref("");
const newEntryParentPath = ref("");
const newEntryType = ref<"file" | "directory">("file");

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

const imagePreview = computed({
  get: () => explorerState.value.imagePreview ?? true,
  set: (val: boolean) => {
    explorerState.value = { ...explorerState.value, imagePreview: val };
  },
});

const activePreviewEnabled = computed(() => {
  if (activePreviewType.value === "image") return imagePreview.value;
  return markdownPreview.value;
});

function toggleActivePreview() {
  if (activePreviewType.value === "image") {
    imagePreview.value = !imagePreview.value;
  } else {
    markdownPreview.value = !markdownPreview.value;
  }
}

const treeEl = ref<HTMLElement | null>(null);
const treePanelBridgeRef = ref<InstanceType<typeof FileExplorerTreePanelBridge> | null>(
  null,
);
const treeCollapsed = computed({
  get: () => explorerState.value.treeCollapsed ?? false,
  set: (val: boolean) => {
    explorerState.value = { ...explorerState.value, treeCollapsed: val };
  },
});
const editorRef = ref<{ triggerSave: () => void; getScrollTop: () => number; openSearch: () => void } | null>(null);
const editorScrollPosition = ref(0);
const selectionReady = ref(false);
const syncingTreeSelection = ref(false);
let tree: InstanceType<typeof FileTree> | null = null;
let treeSubscription: (() => void) | null = null;
let moveUnsubscribe: (() => void) | null = null;
let batchUnsubscribe: (() => void) | null = null;

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
const treePanelDefaultSize = computed(() =>
  treeCollapsed.value ? 0 : treeDefaultSize.value,
);
const previewDefaultSize = computed(() =>
  treeCollapsed.value ? 100 : 100 - treeDefaultSize.value,
);

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
const isGitRepo = useProjectIsGitRepo(() => worktree.value?.projectId);
const gitQueriesEnabled = computed(() => isGitRepo.value === true);
const { data: paths } = useQuery(fileTreeQueryOptions(() => props.worktreeId));
const { data: gitStatus } = useQuery({
  ...gitStatusQueryOptions(() => props.worktreeId),
  enabled: gitQueriesEnabled,
});

const filteredPaths = computed(() => {
  const all = paths.value;
  if (!all) return null;
  if (!showMarkdownOnly.value) return all;
  return all.filter((p) => p.endsWith(".md"));
});

const selectedRelativePath = computed(() => {
  if (ownsRoute.value) {
    const encoded = route.query.file;
    if (typeof encoded === "string" && encoded) {
      const worktreePath = worktree.value?.path;
      if (!worktreePath) return null;
      const fullPath = decodeURIComponent(encoded);
      const prefix = worktreePath.endsWith("/") ? worktreePath : `${worktreePath}/`;
      if (!fullPath.startsWith(prefix)) return null;
      return fullPath.slice(prefix.length);
    }
  }
  return explorerState.value.lastFilePath ?? null;
});

const activePreviewType = computed(() =>
  selectedRelativePath.value ? getFilePreviewType(selectedRelativePath.value) : "code",
);

const showMarkdownPreview = computed(
  () => markdownPreview.value && activePreviewType.value === "markdown",
);

const showImagePreview = computed(
  () => imagePreview.value && activePreviewType.value === "image",
);

useExplorerContextQueueBridge({
  annotationState,
  contextQueue,
  relativePath: selectedRelativePath,
  worktreePath: () => worktree.value?.path,
  fileQuery: () => {
    if (typeof route.query.file === "string") return route.query.file;
    const rel = explorerState.value.lastFilePath;
    const wt = worktree.value?.path;
    if (!rel || !wt) return undefined;
    return encodeURIComponent(getFullPath(rel));
  },
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
  if (!ownsRoute.value) return;
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
  if (ownsRoute.value) {
    const query = { ...route.query };
    delete query.file;
    router.replace({ query });
  }
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
} = useQuery({
  ...fileContentQueryOptions(
    () => props.worktreeId,
    () => selectedRelativePath.value,
  ),
  enabled: computed(
    () =>
      Boolean(props.worktreeId && selectedRelativePath.value) &&
      !showImagePreview.value,
  ),
});

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
  if (!relativePath || !worktree.value?.path) return;
  if (ownsRoute.value && route.query.file) return;
  const pathSet = paths.value;
  if (pathSet && !pathSet.includes(relativePath)) return;
  if (!explorerState.value.openFiles?.length) {
    persistOpenFiles(seedOpenFiles(undefined, relativePath), relativePath);
  }
  if (ownsRoute.value) {
    navigateToFile(relativePath);
  }
}

function syncSelectionToUrl(selectedPaths: string[]) {
  if (!selectionReady.value || syncingTreeSelection.value) return;
  const selected = selectedPaths[0];
  if (selected) {
    if (!isPreviewableFile(selected)) return;
    if (!ownsRoute.value) {
      openFileInTab(selected);
      return;
    }
    const currentFile = route.query.file;
    const encoded = encodeURIComponent(getFullPath(selected));
    if (currentFile === encoded) return;
    openFileInTab(selected);
  } else if (ownsRoute.value && route.query.file !== undefined) {
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
  moveUnsubscribe?.();
  moveUnsubscribe = null;
  batchUnsubscribe?.();
  batchUnsubscribe = null;
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
    dragAndDrop: true,
    density: "compact",
    icons: "minimal",
    initialExpandedPaths: initialExpandedPaths(),
    onSelectionChange: syncSelectionToUrl,
    renaming: {
      onRename: ({ sourcePath, destinationPath }) => {
        moveFileMutation.mutate({ from: sourcePath, to: destinationPath });
      },
    },
    unsafeCSS: `
      [data-file-tree-virtualized-scroll='true'] {
        scrollbar-gutter: auto;
      }
    `,
  });
  tree.render({ fileTreeContainer: treeEl.value });

  tree.setComposition({
    contextMenu: {
      triggerMode: "right-click",
      buttonVisibility: "when-needed",
      render: (item, context) =>
        createFileContextMenu(item, context, {
          onCopyName: (name) => navigator.clipboard.writeText(name),
          onCopyPath: (path) => navigator.clipboard.writeText(path),
          onNewFile: (parent) => handleNewEntry(parent, "file"),
          onNewFolder: (parent) => handleNewEntry(parent, "directory"),
          onRename: (path) => tree!.startRenaming(path),
          onDelete: (paths, isDir) => {
            pendingDeletePaths.value = paths.map((p) => ({ path: p, isDir }));
            deleteDialogOpen.value = true;
          },
        }, tree!.getSelectedPaths()),
    },
  });

  moveUnsubscribe = tree.onMutation("move", ({ from, to }) => {
    moveFileMutation.mutate({ from, to });
  });

  batchUnsubscribe = tree.onMutation("batch", ({ events }) => {
    const moves = events.filter(
      (e): e is FileTreeMoveEvent => e.operation === "move",
    );
    if (moves.length === 0) return;
    Promise.all(moves.map(({ from, to }) => moveFileMutation.mutateAsync({ from, to })))
      .then(() => invalidateWorkspaceFs(queryClient, props.worktreeId))
      .catch(() => { /* toast already shown by useMoveFile onError */ });
  });

  treeSubscription = tree.subscribe(() => {
    persistExpandedPaths();
  });

  if (gitStatus.value?.files) {
    tree.setGitStatus(toPierreGitStatusEntries(gitStatus.value.files));
  }

  revealActiveFileInTree();
  selectionReady.value = true;
}

function getTreeScrollEl(): HTMLElement | null {
  if (!treeEl.value) return null;
  return (treeEl.value.querySelector('[data-file-tree-virtualized-scroll="true"]') as HTMLElement | null) ?? treeEl.value;
}

function syncTreeToPaths(pathList: string[], prevPathList?: readonly string[] | null) {
  if (!treeEl.value) return;
  if (tree && prevPathList && pathsListEqual(pathList, prevPathList)) return;
  let savedScrollTop = 0;
  if (tree) {
    savedScrollTop = getTreeScrollEl()?.scrollTop ?? 0;
    const expandedPaths = collectExpandedPathsFromDom();
    explorerState.value = { ...explorerState.value, expandedPaths };
    teardownTree();
  }
  void nextTick(() => {
    mountTree(pathList);
    if (savedScrollTop > 0) {
      requestAnimationFrame(() => {
        const scrollEl = getTreeScrollEl();
        if (scrollEl) scrollEl.scrollTop = savedScrollTop;
      });
    }
  });
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
    if (ownsRoute.value) {
      navigateToFile(preferred);
    } else {
      doOpenFileInTab(preferred);
    }
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

watch(
  selectedRelativePath,
  (newPath, oldPath) => {
    if (oldPath && editorRef.value) {
      const top = editorRef.value.getScrollTop();
      if (top > 0) {
        explorerState.value = {
          ...explorerState.value,
          scrollPositions: { ...explorerState.value.scrollPositions, [oldPath]: top },
        };
      }
    }
    editorScrollPosition.value = newPath
      ? (explorerState.value.scrollPositions?.[newPath] ?? 0)
      : 0;
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

function handleSearchFromTab() {
  editorRef.value?.openSearch();
}

function toggleTree() {
  if (treeCollapsed.value) {
    treePanelBridgeRef.value?.expand();
  } else {
    treePanelBridgeRef.value?.collapse();
  }
}

async function onDeleteConfirm() {
  deleteDialogOpen.value = false;
  const paths = pendingDeletePaths.value;
  pendingDeletePaths.value = [];
  await Promise.all(paths.map(({ path }) => deleteFileMutation.mutateAsync({ path })));
}

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
  const type = newEntryType.value;
  newEntryDialogOpen.value = false;
  await createFileMutation.mutateAsync({ path, type });
  if (type === "file") {
    if (paths.value?.includes(path)) {
      openFileInTab(path);
    } else {
      const stop = watch(
        () => paths.value,
        (newPaths) => {
          if (newPaths?.includes(path)) {
            stop();
            openFileInTab(path);
          }
        },
      );
    }
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
            :markdown-preview="activePreviewEnabled"
            :active-preview-type="activePreviewType"
            @select="openFileInTab"
            @close="closeFileTabHandler"
            @save="handleSaveFromTab"
            @search="handleSearchFromTab"
            @toggle-tree="toggleTree"
            @toggle-markdown-preview="toggleActivePreview"
          />
          <div v-if="!selectedRelativePath" class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <IsoFileOpen class="size-20 text-muted-foreground" />
            <p class="text-sm">Select a file to preview</p>
          </div>

          <div
            v-else-if="fileLoading"
            class="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <IsoClockLoader class="size-20 text-muted-foreground" />
            Loading file…
          </div>

          <div
            v-else-if="fileError"
            class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-destructive"
          >
            <IsoFileDownloadOff class="size-20 text-muted-foreground" />
            {{ fileErrorObj instanceof Error ? fileErrorObj.message : "Could not load file" }}
          </div>

          <ImagePreview
            v-else-if="showImagePreview && selectedRelativePath"
            :worktree-id="worktreeId"
            :relative-path="selectedRelativePath"
          />

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
              :scroll-top="editorScrollPosition"
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
        v-slot="treePanel"
        :default-size="treePanelDefaultSize"
        :min-size="FILE_EXPLORER_MIN_TREE_SIZE"
        :max-size="FILE_EXPLORER_MAX_TREE_SIZE"
        collapsible
        :collapsed-size="0"
      >
        <FileExplorerTreePanelBridge
          ref="treePanelBridgeRef"
          v-bind="treePanel"
          v-model:stored-collapsed="treeCollapsed"
        />
        <div class="flex h-full min-h-0 flex-col">
          <div class="flex shrink-0 items-center justify-end px-1 py-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New file"
              title="New file"
              class="text-muted-foreground"
              @click="handleNewEntry('', 'file')"
            >
              <FilePlusIcon class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="mr-auto text-muted-foreground"
              aria-label="New folder"
              title="New folder"              
              @click="handleNewEntry('', 'directory')"
            >
              <FolderPlusIcon class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              :aria-label="showMarkdownOnly ? 'Show all files' : 'Show markdown files only'"
              :title="showMarkdownOnly ? 'Show all files' : 'Show markdown files only'"
              :class="showMarkdownOnly ? 'text-foreground' : 'text-muted-foreground'"
              @click="showMarkdownOnly = !showMarkdownOnly"
            >
              <FileTextIcon class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Search files"
              title="Search files"
              class="ml-1"
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
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="onDeleteConfirm"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="newEntryDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader class="items-start text-left">
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
  </div>
</template>
