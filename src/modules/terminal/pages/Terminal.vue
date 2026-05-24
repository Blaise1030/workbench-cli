<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { Terminal as WTerm, type WTerm as WTermInstance } from "@wterm/vue";
import "@wterm/vue/css";
import "@/assets/terminal.css";
import { fileTreeQueryOptions } from "@/modules/file-explorer/queries";
import { useTerminalSessions } from "@/modules/terminal/hooks/terminal-sessions";
import {
  captureDragPayload,
  clearDragPayload,
  formatPathsForTerminal,
  hasDroppableData,
  pathsFromDataTransfer,
  plainTextFromDataTransfer,
  type DropPathOptions,
} from "@/modules/terminal/lib/terminal-drop";
import { worktreeQueryOptions } from "@/modules/workspace/queries";
import { cn } from "@/lib/utils";

const props = defineProps<{
  sessionId: string;
}>();

const route = useRoute();
const sessions = useTerminalSessions();
const termRef = ref<InstanceType<typeof WTerm> | null>(null);
const dropZoneRef = ref<HTMLElement | null>(null);
const dragDepth = ref(0);
const initError = ref<string | null>(null);
let readyInstance: WTermInstance | null = null;
let dropListenersTarget: HTMLElement | null = null;

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
  if (dropZoneRef.value) attachDropListeners(dropZoneRef.value);
}

function onError(err: unknown) {
  initError.value =
    err instanceof Error ? err.message : "Failed to load terminal emulator";
}

function insertAtPrompt(text: string) {
  sessions.get(props.sessionId)?.sendInput(text);
  readyInstance?.focus();
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragDepth.value = 0;
  const dt = event.dataTransfer;
  if (!dt) {
    clearDragPayload();
    return;
  }

  const paths = pathsFromDataTransfer(dt, dropPathOptions.value);
  clearDragPayload();
  if (paths.length) {
    insertAtPrompt(formatPathsForTerminal(paths));
    return;
  }

  const plain = plainTextFromDataTransfer(dt, dropPathOptions.value);
  if (plain) insertAtPrompt(plain);
}

function onDragEnter(event: DragEvent) {
  if (!hasDroppableData(event.dataTransfer)) return;
  event.preventDefault();
  if (event.dataTransfer) captureDragPayload(event.dataTransfer);
  dragDepth.value += 1;
}

function onDragOver(event: DragEvent) {
  if (!hasDroppableData(event.dataTransfer)) return;
  event.preventDefault();
  if (event.dataTransfer) {
    captureDragPayload(event.dataTransfer);
    event.dataTransfer.dropEffect = "copy";
  }
}

function onDragLeave(event: DragEvent) {
  if (!hasDroppableData(event.dataTransfer)) return;
  event.preventDefault();
  dragDepth.value = Math.max(0, dragDepth.value - 1);
  if (dragDepth.value === 0) clearDragPayload();
}

function attachDropListeners(el: HTMLElement) {
  detachDropListeners();
  dropListenersTarget = el;
  el.addEventListener("dragenter", onDragEnter, true);
  el.addEventListener("dragover", onDragOver, true);
  el.addEventListener("dragleave", onDragLeave, true);
  el.addEventListener("drop", onDrop, true);
}

function detachDropListeners() {
  const el = dropListenersTarget;
  if (!el) return;
  el.removeEventListener("dragenter", onDragEnter, true);
  el.removeEventListener("dragover", onDragOver, true);
  el.removeEventListener("dragleave", onDragLeave, true);
  el.removeEventListener("drop", onDrop, true);
  dropListenersTarget = null;
}

onBeforeUnmount(detachDropListeners);

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
        dragDepth > 0 && 'terminal-drop-zone--active',
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
