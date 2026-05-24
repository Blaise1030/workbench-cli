<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { Terminal as WTerm, type WTerm as WTermInstance } from "@wterm/vue";
import "@wterm/vue/css";
import "@/assets/terminal.css";
import { useTerminalSessions } from "@/modules/terminal/hooks/terminal-sessions";
import {
  formatPathsForTerminal,
  hasDroppableData,
  pathsFromDataTransfer,
  plainTextFromDataTransfer,
} from "@/modules/terminal/lib/terminal-drop";
import { cn } from "@/lib/utils";

const props = defineProps<{
  sessionId: string;
}>();

const sessions = useTerminalSessions();
const termRef = ref<InstanceType<typeof WTerm> | null>(null);
const dragDepth = ref(0);
const initError = ref<string | null>(null);
let readyInstance: WTermInstance | null = null;
let dropListenersTarget: HTMLElement | null = null;

function bindSession() {
  if (!readyInstance || !props.sessionId) return;
  sessions.attach(props.sessionId, readyInstance);
}

function onReady(wt: WTermInstance) {
  initError.value = null;
  readyInstance = wt;
  bindSession();
  attachDropListeners(wt.element);
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
  dragDepth.value = 0;
  const dt = event.dataTransfer;
  if (!dt) return;

  const paths = pathsFromDataTransfer(dt);
  if (paths.length) {
    insertAtPrompt(formatPathsForTerminal(paths));
    return;
  }

  const plain = plainTextFromDataTransfer(dt);
  if (plain) insertAtPrompt(plain);
}

function onDragEnter(event: DragEvent) {
  if (!hasDroppableData(event.dataTransfer)) return;
  event.preventDefault();
  dragDepth.value += 1;
}

function onDragOver(event: DragEvent) {
  if (!hasDroppableData(event.dataTransfer)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
}

function onDragLeave(event: DragEvent) {
  if (!hasDroppableData(event.dataTransfer)) return;
  event.preventDefault();
  dragDepth.value = Math.max(0, dragDepth.value - 1);
}

function attachDropListeners(el: HTMLElement) {
  detachDropListeners();
  dropListenersTarget = el;
  el.addEventListener("dragenter", onDragEnter);
  el.addEventListener("dragover", onDragOver);
  el.addEventListener("dragleave", onDragLeave);
  el.addEventListener("drop", onDrop);
}

function detachDropListeners() {
  const el = dropListenersTarget;
  if (!el) return;
  el.removeEventListener("dragenter", onDragEnter);
  el.removeEventListener("dragover", onDragOver);
  el.removeEventListener("dragleave", onDragLeave);
  el.removeEventListener("drop", onDrop);
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
