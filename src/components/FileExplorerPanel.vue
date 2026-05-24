<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FileIcon, FolderTreeIcon } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { FileTree } from "@pierre/trees";
import {
  fileContentQueryOptions,
  fileTreeQueryOptions,
  gitStatusQueryOptions,
  worktreeQueryOptions,
  type GitStatusEntry,
} from "@/api/workspace";
import FilePreviewCodeView from "@/components/FilePreviewCodeView.vue";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();

const treeEl = ref<HTMLElement | null>(null);
const selectionReady = ref(false);
let tree: InstanceType<typeof FileTree> | null = null;

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

function syncSelectionToUrl(selectedPaths: string[]) {
  if (!selectionReady.value) return;
  const selected = selectedPaths[0];
  const currentFile = route.query.file;
  if (selected) {
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

function mountTree(newPaths: string[]) {
  if (!treeEl.value || tree || !Array.isArray(newPaths)) return;

  tree = new FileTree({
    paths: newPaths,
    density: "compact",
    icons: "minimal",
    onSelectionChange: syncSelectionToUrl,
  });
  tree.render({ fileTreeContainer: treeEl.value });

  if (gitStatus.value?.files) {
    tree.setGitStatus(toPierreGitStatusEntries(gitStatus.value.files));
  }

  restoreSelectionFromUrl();
  selectionReady.value = true;
}

onMounted(() => {
  if (paths.value) mountTree(paths.value);
});

watch(
  () => gitStatus.value,
  (status) => {
    if (!tree || !status) return;
    tree.setGitStatus(toPierreGitStatusEntries(status.files));
  },
);

watch(
  () => paths.value,
  (newPaths) => {
    if (!newPaths) return;
    mountTree(newPaths);
  },
);

watch(selectedRelativePath, () => {
  restoreSelectionFromUrl();
});

onUnmounted(() => {
  tree?.cleanUp();
  tree = null;
  selectionReady.value = false;
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
      id="file-explorer-split"
      direction="horizontal"
      class="min-h-0 flex-1"
    >
      <ResizablePanel
        id="file-explorer-preview"
        :default-size="70"
        :min-size="45"
      >
        <div class="flex h-full min-h-0 flex-col">
          <header
            v-if="selectedRelativePath"
            class="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3"
          >
            <FileIcon class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="min-w-0 truncate font-mono text-xs text-muted-foreground">
              {{ selectedRelativePath }}
            </span>
          </header>

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
        :default-size="30"
        :min-size="15"
        :max-size="55"
      >
        <div
          ref="treeEl"
          class="trees-shadcn h-full min-h-0 overflow-auto px-1 py-1"
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
