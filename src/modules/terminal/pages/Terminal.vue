<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useDropZone } from "@vueuse/core";
import { Terminal as WTerm, type WTerm as WTermInstance } from "@wterm/vue";
import "@wterm/vue/css";
import "@/assets/terminal.css";
import { fileTreeQueryOptions } from "@/modules/file-explorer/queries";
import { useTerminalSessions } from "@/modules/terminal/hooks/terminal-sessions";
import {
  captureDragPayload,
  checkDroppableItems,
  clearDragPayload,
  dedupeDropPaths,
  formatPathsForTerminal,
  isUsableDropPath,
  mergeDropFiles,
  partitionDroppedFiles,
  pathsFromDataTransfer,
  plainTextFromDataTransfer,
  type DropPathOptions,
} from "@/modules/terminal/lib/terminal-drop";
import { uploadWorkbenchDropAssets } from "@/modules/terminal/lib/upload-drop-assets";
import { worktreeQueryOptions } from "@/modules/workspace/queries";
import { cn } from "@/lib/utils";

const props = defineProps<{
  sessionId: string;
}>();

const route = useRoute();
const sessions = useTerminalSessions();
const termRef = ref<InstanceType<typeof WTerm> | null>(null);
const dropZoneRef = useTemplateRef("dropZoneRef");
const initError = ref<string | null>(null);
let readyInstance: WTermInstance | null = null;

const worktreeId = computed(() => route.params.worktreeId as string);
const { data: worktree } = useQuery(worktreeQueryOptions(worktreeId));
const { data: fileTreePaths } = useQuery(fileTreeQueryOptions(worktreeId));

const dropPathOptions = computed((): DropPathOptions | undefined => {
  const root = worktree.value?.path;
  if (!root) return undefined;
  return {
    worktreeRoot: root,
    fileTreePaths: fileTreePaths.value,
  };
});

function bindSession() {
  if (!readyInstance || !props.sessionId) return;
  sessions.attach(props.sessionId, readyInstance);
}

function onReady(wt: WTermInstance) {
  initError.value = null;
  readyInstance = wt;
  bindSession();
}

function onError(err: unknown) {
  initError.value =
    err instanceof Error ? err.message : "Failed to load terminal emulator";
}

function insertAtPrompt(text: string) {
  sessions.get(props.sessionId)?.sendInput(text);
  readyInstance?.focus();
}

async function insertFromDrop(files: File[] | null, event: DragEvent) {
  const opts = dropPathOptions.value;
  const paths: string[] = [];
  const dt = event.dataTransfer;

  // Prefer native paths from the drag payload (macOS screenshots, Finder, file tree).
  if (dt) {
    for (const path of pathsFromDataTransfer(dt, opts)) {
      if (isUsableDropPath(path, opts)) paths.push(path);
    }
  }

  const hasNativePaths = paths.length > 0;
  const fileList = mergeDropFiles(files, dt);
  let toUpload: File[] = [];

  if (fileList.length) {
    const split = partitionDroppedFiles(fileList, opts);
    paths.push(...split.resolved);
    // Do not copy to ~/.workbench/image when we already have a real on-disk path.
    if (!hasNativePaths) toUpload = split.needsUpload;
  }

  if (toUpload.length) {
    try {
      const uploaded = await uploadWorkbenchDropAssets(
        worktreeId.value,
        toUpload,
      );
      paths.push(...uploaded);
    } catch {
      clearDragPayload();
      return;
    }
  }

  clearDragPayload();
  const unique = dedupeDropPaths(paths);
  if (unique.length) {
    insertAtPrompt(formatPathsForTerminal(unique));
    return;
  }

  if (dt) {
    const plain = plainTextFromDataTransfer(dt, opts);
    if (plain) insertAtPrompt(plain);
  }
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  checkValidity: checkDroppableItems,
  multiple: true,
  onOver(_files, event) {
    if (event.dataTransfer) captureDragPayload(event.dataTransfer);
  },
  onLeave() {
    clearDragPayload();
  },
  onDrop: insertFromDrop,
});

watch(
  () => props.sessionId,
  (id, prev) => {
    if (prev) sessions.detach(prev);
    nextTick(bindSession);
  },
);

function onData(data: string) {
  sessions.get(props.sessionId)?.sendInput(data);
}

function onResize(cols: number, rows: number) {
  sessions.get(props.sessionId)?.sendResize(cols, rows);
}

function onTitle(title: string) {
  sessions.get(props.sessionId)?.setWindowTitle(title);
}
</script>

<template>
  <div
    ref="dropZoneRef"
    :class="
      cn(
        'terminal-drop-zone size-full min-h-0',
        isOverDropZone && 'terminal-drop-zone--active',
      )
    "
  >
    <p
      v-if="initError"
      class="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive"
    >
      {{ initError }}
    </p>
    <WTerm
      v-show="!initError"
      ref="termRef"
      theme="app"
      auto-resize
      cursor-blink
      @ready="onReady"
      @error="onError"
      @data="onData"
      @resize="onResize"
      @title="onTitle"
      class="size-full min-h-0"
    />
  </div>
</template>
