<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
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
import FilePreviewCodeView from "@/modules/file-explorer/components/FilePreviewCodeView.vue";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  clampFileExplorerTreeSize,
  FILE_EXPLORER_DEFAULT_TREE_SIZE,
  FILE_EXPLORER_MAX_TREE_SIZE,
  FILE_EXPLORER_MIN_TREE_SIZE,
  mergeExpandedPaths,
  useFileExplorerStorage,
} from "@/modules/file-explorer/lib/file-explorer-storage";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();

const explorerState = useFileExplorerStorage(() => props.worktreeId);

const treeEl = ref<HTMLElement | null>(null);
const selectionReady = ref(false);
let tree: InstanceType<typeof FileTree> | null = null;
let treeSubscription: (() => void) | null = null;

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

function persistLastFile(relativePath: string) {
  explorerState.value = {
    ...explorerState.value,
    lastFilePath: relativePath,
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
  router.replace({
    query: {
      ...route.query,
      file: encodeURIComponent(getFullPath(relativePath)),
    },
  });
}

function syncSelectionToUrl(selectedPaths: string[]) {
  if (!selectionReady.value) return;
  const selected = selectedPaths[0];
  const currentFile = route.query.file;
  if (selected) {
    persistLastFile(selected);
    const encoded = encodeURIComponent(getFullPath(selected));
    if (currentFile === encoded) return;
    router.replace({ query: { ...route.query, file: encoded } });
  } else if (currentFile !== undefined) {
    const query = { ...route.query };
    delete query.file;
    router.replace({ query });
  }
}

function restoreSelectionFromUrl() {
  if (!tree) return;
  const relativePath = selectedRelativePath.value;
  if (!relativePath) return;
  tree.getItem(relativePath)?.select();
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

  restoreSelectionFromUrl();
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
  restoreSelectionFromUrl();
});

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
  },
);

onUnmounted(() => {
  teardownTree();
});
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
            <FilePreviewCodeView
              :file-path="fileContent.path"
              :content="fileContent.content"
              class="min-h-0 flex-1"
            />
          </template>
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
  </div>
</template>
