<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useDropZone } from "@vueuse/core";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
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
import { useRouter } from "vue-router";
import { useWorktreePanels } from "@/modules/workspace/lib/worktree-panels-storage";
import { createFileLinkProvider } from "@/modules/terminal/lib/terminal-file-links";
import { terminalSelectionColors } from "@/modules/terminal/lib/terminal-theme";
import { cn } from "@/lib/utils";

const props = defineProps<{
  sessionId: string;
}>();

const route = useRoute();
const sessions = useTerminalSessions();
const terminalElRef = useTemplateRef<HTMLDivElement>("terminalElRef");
const dropZoneRef = useTemplateRef("dropZoneRef");
const initError = ref<string | null>(null);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let fitInterval: ReturnType<typeof setInterval> | null = null;

const worktreeId = computed(() => route.params.worktreeId as string);
const { data: worktree } = useQuery(worktreeQueryOptions(worktreeId));
const router = useRouter();
const panelsState = useWorktreePanels(worktreeId);
const { data: fileTreePaths } = useQuery(fileTreeQueryOptions(worktreeId));

const dropPathOptions = computed((): DropPathOptions | undefined => {
  const root = worktree.value?.path;
  if (!root) return undefined;
  return {
    worktreeRoot: root,
    fileTreePaths: fileTreePaths.value,
  };
});

function buildTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  const isDark = document.documentElement.classList.contains("dark");
  return {
    background: v("--background"),
    foreground: v("--foreground"),
    cursor: v("--ring"),
    cursorAccent: v("--background"),
    ...terminalSelectionColors(isDark),
    black: v("--card"),
    red: v("--destructive"),
    green: v("--chart-4"),
    yellow: v("--chart-3"),
    blue: v("--primary"),
    magenta: v("--chart-5"),
    cyan: v("--chart-2"),
    white: v("--foreground"),
    brightBlack: v("--muted-foreground"),
    brightRed: v("--destructive"),
    brightGreen: v("--chart-4"),
    brightYellow: v("--chart-3"),
    brightBlue: v("--primary"),
    brightMagenta: v("--chart-5"),
    brightCyan: v("--chart-2"),
    brightWhite: v("--foreground"),
  };
}

onMounted(async () => {
  const el = terminalElRef.value;
  if (!el) return;

  await document.fonts.ready;

  try {
    const s = getComputedStyle(document.documentElement);
    terminal = new Terminal({
      cursorBlink: true,
      theme: buildTheme(),
      fontFamily: s.getPropertyValue("--font-mono").trim() || "monospace",
      allowTransparency: false,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // WebGL unavailable, canvas renderer used instead
    }

    terminal.open(el);
    terminal.registerLinkProvider(
      createFileLinkProvider(
        terminal,
        () => worktree.value?.path ?? "",
        (path) => {
          panelsState.value = { ...panelsState.value, explorer: true };
          void router.push({
            name: "explorer",
            params: { worktreeId: worktreeId.value },
            query: { ...route.query, file: encodeURIComponent(path) },
          });
        },
        () => fileTreePaths.value,
      ),
    );
    fitAddon.fit();

    terminal.onData((data) => sessions.get(props.sessionId)?.sendInput(data));
    terminal.onResize(({ cols, rows }) => sessions.get(props.sessionId)?.sendResize(cols, rows));
    terminal.onTitleChange((title) => sessions.get(props.sessionId)?.setWindowTitle(title));

    resizeObserver = new ResizeObserver(() => fitAddon?.fit());
    resizeObserver.observe(el);

    fitInterval = setInterval(() => fitAddon?.fit(), 2_000);

    sessions.attach(props.sessionId, terminal);
    initError.value = null;
  } catch (err) {
    initError.value =
      err instanceof Error ? err.message : "Failed to load terminal emulator";
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (fitInterval) clearInterval(fitInterval);
  fitInterval = null;
  terminal?.dispose();
  terminal = null;
  fitAddon = null;
});

watch(
  () => props.sessionId,
  (id, prev) => {
    if (prev) sessions.detach(prev);
    if (terminal) nextTick(() => sessions.attach(id, terminal!));
  },
);

function insertAtPrompt(text: string) {
  sessions.get(props.sessionId)?.sendInput(text);
  terminal?.focus();
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
    if (!hasNativePaths) toUpload = split.needsUpload;
  }

  if (toUpload.length) {
    try {
      const uploaded = await uploadWorkbenchDropAssets(worktreeId.value, toUpload);
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
    <div v-show="!initError" class="size-full min-h-0 px-3">
      <div ref="terminalElRef" class="size-full min-h-0" />
    </div>
  </div>
</template>
