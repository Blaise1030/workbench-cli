<script setup lang="ts">
import { computed, provide, ref, watch, type ComponentPublicInstance } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { useQuery } from "@tanstack/vue-query";
import {
  FolderTreeIcon,
  GitBranchIcon,
  TerminalIcon,
  XIcon,
} from "@lucide/vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import Terminal from "@/modules/terminal/pages/Terminal.vue";
import GitPanel from "@/modules/git/pages/GitPanel.vue";
import FileExplorerPanel from "@/modules/file-explorer/pages/FileExplorerPanel.vue";
import { useFileExplorerStorage } from "@/modules/file-explorer/lib/file-explorer-storage";
import { Button } from "@/components/ui/button";
import WorkspacePanelMenu from "@/modules/workspace/components/WorkspacePanelMenu.vue";
import type { AddTerminalChoice } from "@/modules/workspace/types/add-terminal-choice";
import WorkspaceSidebarToggle from "@/modules/workspace/components/WorkspaceSidebarToggle.vue";
import TerminalResumeDialog from "@/modules/terminal/components/TerminalResumeDialog.vue";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  terminalSessionsKey,
  useTerminalSessions,
} from "@/modules/terminal/hooks/terminal-sessions";
import {
  useCreateTerminalMutation,
  useDeleteTerminalMutation,
  useTerminalsQuery,
} from "@/modules/terminal/queries";
import { useGitPanelStorage } from "@/modules/git/lib/git-panel-storage";
import {
  activateWorktreeAuxPanel,
  useWorktreePanels,
  buildWorkspaceQuery,
  clampSplitTerminalSize,
  gitPanelId,
  explorerPanelId,
  SPLIT_AUX_MIN_SIZE,
  SPLIT_TERMINAL_DEFAULT_SIZE,
  SPLIT_TERMINAL_MIN_SIZE,
  type WorktreeLastRoute,
} from "@/modules/workspace/lib/worktree-panels-storage";
import { useWorktreeLayoutMode } from "@/modules/workspace/hooks/use-worktree-layout-mode";
import { gitStatusQueryOptions } from "@/modules/git/queries";
import { worktreeQueryOptions } from "@/modules/workspace/queries";
import { useAppTheme } from "@/shared/hooks/useAppTheme";
import ContextQueuePopover from "@/modules/context-queue/components/ContextQueuePopover.vue";
import { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";
import { useContextQueueKeybinding } from "@/modules/context-queue/hooks/use-context-queue-keybinding";
import { createContextQueueAnnotationsState } from "@/modules/context-queue/lib/context-queue-annotations-state";
import {
  contextQueueAnnotationsKey,
  contextQueueGitItemIdsKey,
  contextQueueKey,
} from "@/modules/context-queue/lib/context-queue-keys";
const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();
const { effectiveTheme } = useAppTheme();
const sessions = useTerminalSessions();

/** Remount terminal emulator when theme changes so xterm picks up new CSS tokens. */
const routerViewKey = computed(() => {
  if (route.name === "terminal") {
    return `${route.params.terminalId as string}:${effectiveTheme.value}`;
  }
  return route.fullPath;
});

const panelsState = useWorktreePanels(() => props.worktreeId);
const gitPanelState = useGitPanelStorage(() => props.worktreeId);
const explorerState = useFileExplorerStorage(() => props.worktreeId);
const {
  layoutMode,
  layoutPrefs,
  splitAuxPanel,
  activeTerminalId,
  workspaceQuery,
} = useWorktreeLayoutMode(() => props.worktreeId);
const { data: worktree } = useQuery(worktreeQueryOptions(() => props.worktreeId));
/** Keep git status warm while on terminal (explorer/git panels unmount). */
useQuery(gitStatusQueryOptions(() => props.worktreeId));
const contextQueue = useContextQueue(() => props.worktreeId, sessions);
provide(contextQueueKey, contextQueue);
const contextQueueAnnotations = createContextQueueAnnotationsState(
  () => props.worktreeId,
);
provide(contextQueueAnnotationsKey, contextQueueAnnotations);
const gitItemIdsRef = ref<string[]>([]);
provide(contextQueueGitItemIdsKey, gitItemIdsRef);

const effectiveRouteName = computed(() => {
  if (layoutMode.value !== "split") return route.name;
  if (splitAuxPanel.value === "explorer") return "explorer";
  if (splitAuxPanel.value === "git") return "git";
  return route.name;
});

const effectiveFileQuery = computed(() => {
  if (typeof route.query.file === "string") return route.query.file;
  const rel = explorerState.value.lastFilePath;
  const wt = worktree.value?.path;
  if (!rel || !wt) return undefined;
  const base = wt.endsWith("/") ? wt.slice(0, -1) : wt;
  return encodeURIComponent(`${base}/${rel.replace(/^\//, "")}`);
});

useContextQueueKeybinding({
  routeName: () => effectiveRouteName.value,
  worktreePath: () => worktree.value?.path,
  fileQuery: () => effectiveFileQuery.value,
  gitItemIds: () => gitItemIdsRef.value,
  queue: contextQueue,
  annotations: contextQueueAnnotations,
});

const { data: terminals, isLoading } = useTerminalsQuery(
  () => props.worktreeId,
);
const createTerminal = useCreateTerminalMutation(() => props.worktreeId);
const deleteTerminal = useDeleteTerminalMutation(() => props.worktreeId);

const terminalTabs = computed(() => terminals.value ?? []);

const terminalTabItems = computed(() =>
  terminalTabs.value.map((t) => ({
    id: t.id,
    type: "terminal" as const,
    title: sessions.tabLabel(t.id),
  })),
);

const isGitVisible = computed(() =>
  layoutMode.value === "split"
    ? splitAuxPanel.value === "git"
    : route.name === "git",
);

const isExplorerVisible = computed(() =>
  layoutMode.value === "split"
    ? splitAuxPanel.value === "explorer"
    : route.name === "explorer",
);

const splitTerminalKey = computed(
  () => `${activeTerminalId.value}:${effectiveTheme.value}`,
);

const splitTerminalDefaultSize = computed(() =>
  clampSplitTerminalSize(
    layoutPrefs.value.splitTerminalSize ?? SPLIT_TERMINAL_DEFAULT_SIZE,
  ),
);

const splitAuxDefaultSize = computed(
  () => 100 - splitTerminalDefaultSize.value,
);

const persistSplitTerminalSize = useDebounceFn((size: number) => {
  if (!worktree.value?.projectId) return;
  const next = clampSplitTerminalSize(size);
  if (layoutPrefs.value.splitTerminalSize === next) return;
  layoutPrefs.value = { ...layoutPrefs.value, splitTerminalSize: next };
}, 300);

function onSplitLayout(sizes: number[]) {
  if (!splitAuxPanel.value) return;
  const terminalSize = sizes[0];
  if (typeof terminalSize === "number" && Number.isFinite(terminalSize)) {
    persistSplitTerminalSize(terminalSize);
  }
}

const hasPanelContent = computed(() => {
  if (layoutMode.value === "split") {
    return terminalTabItems.value.length > 0 || splitAuxPanel.value !== null;
  }
  return (
    terminalTabItems.value.length > 0 ||
    route.name === "git" ||
    route.name === "explorer"
  );
});

const activeId = computed(() => {
  if (layoutMode.value === "split") {
    return activeTerminalId.value;
  }
  if (route.name === "terminal") return route.params.terminalId as string;
  if (route.name === "git") return gitPanelId(props.worktreeId);
  if (route.name === "explorer") return explorerPanelId(props.worktreeId);
  return "";
});

const resumeDialogOpen = ref(false);
const resumeDialogTerminalId = ref("");

// Create sessions for loaded terminals
watch(
  terminals,
  (list) => {
    if (!list) return;
    for (const t of list) {
      if (!sessions.get(t.id)) {
        sessions.create({ id: t.id, terminalId: t.id, title: t.title });
      }
    }
  },
  { immediate: true },
);

function persistWorkspaceRoute() {
  const name = route.name;
  if (name === "git") {
    panelsState.value = activateWorktreeAuxPanel(panelsState.value, "git");
    return;
  }
  if (name === "explorer") {
    panelsState.value = activateWorktreeAuxPanel(panelsState.value, "explorer");
    return;
  }
  if (name === "terminal") {
    const terminalId = route.params.terminalId;
    if (typeof terminalId !== "string") return;
    panelsState.value = {
      ...panelsState.value,
      lastRoute: "terminal",
      lastTerminalId: terminalId,
    };
  }
}

watch(
  () => [route.name, route.params.terminalId] as const,
  persistWorkspaceRoute,
  {
    immediate: true,
  },
);

function restoreDefaultRoute(list: { id: string }[]) {
  const state = panelsState.value;
  const lastRoute: WorktreeLastRoute = state.lastRoute ?? "terminal";

  const query = buildWorkspaceQuery(
    worktree.value?.path,
    gitPanelState.value,
    explorerState.value,
  );

  if (lastRoute === "git" && state.git) {
    router.replace({
      name: "git",
      params: { worktreeId: props.worktreeId },
      query,
    });
    return;
  }

  if (lastRoute === "explorer" && state.explorer) {
    router.replace({
      name: "explorer",
      params: { worktreeId: props.worktreeId },
      query,
    });
    return;
  }

  const preferredId =
    state.lastTerminalId && list.some((t) => t.id === state.lastTerminalId)
      ? state.lastTerminalId
      : list[0]?.id;
  if (!preferredId) return;
  router.replace({
    name: "terminal",
    params: { worktreeId: props.worktreeId, terminalId: preferredId },
    query,
  });
}

// Bare /w/:id (no child) → restore last panel when available
watch([terminals, () => route.name], ([list, name]) => {
  if (!list?.length || name !== "workspace") return;
  restoreDefaultRoute(list);
});

// Redirect if current terminal no longer exists
watch([terminals, () => route.params.terminalId], ([list, terminalId]) => {
  if (!list || route.name !== "terminal") return;
  if (terminalId && !list.some((t) => t.id === terminalId)) {
    const first = list[0];
    if (first) {
      router.replace({
        name: "terminal",
        params: { worktreeId: props.worktreeId, terminalId: first.id },
      });
    }
  }
});

function navigateToTerminal(tabId: string) {
  router.push({
    name: "terminal",
    params: { worktreeId: props.worktreeId, terminalId: tabId },
  });
}

async function addTerminal(choice: AddTerminalChoice = { kind: "shell" }) {
  const input =
    choice.kind === "agent"
      ? { title: choice.agent.name, launchCommand: choice.agent.startCommand }
      : undefined;
  const terminal = await createTerminal.mutateAsync(input);
  sessions.create({
    id: terminal.id,
    terminalId: terminal.id,
    title: terminal.title,
  });
  router.push({
    name: "terminal",
    params: { worktreeId: props.worktreeId, terminalId: terminal.id },
  });
}

function openAuxPanel(type: "git" | "explorer") {
  panelsState.value = activateWorktreeAuxPanel(panelsState.value, type);
  if (layoutMode.value === "page") {
    router.push({
      name: type,
      params: { worktreeId: props.worktreeId },
      query: workspaceQuery(),
    });
  }
}

async function closeTab(id: string) {
  if (!window.confirm("Close this terminal?")) return;

  const isActive = id === activeId.value;
  const remaining = terminalTabItems.value.filter((t) => t.id !== id);

  await deleteTerminal.mutateAsync(id);
  sessions.remove(id);

  if (isActive && remaining[0]) {
    navigateToTerminal(remaining[0].id);
  }
}

function navigateToFirstTerminal() {
  const first = terminalTabs.value?.[0];
  if (first) {
    router.push({
      name: "terminal",
      params: { worktreeId: props.worktreeId, terminalId: first.id },
    });
    return;
  }
  router.push({ name: "workspace", params: { worktreeId: props.worktreeId } });
}

function toggleAuxPanel(type: "git" | "explorer") {
  const isActive = type === "git" ? isGitVisible.value : isExplorerVisible.value;

  if (isActive) {
    if (type === "git") {
      panelsState.value = { ...panelsState.value, git: false };
    } else {
      panelsState.value = { ...panelsState.value, explorer: false };
    }
    if (layoutMode.value === "page") {
      navigateToFirstTerminal();
    }
    return;
  }

  openAuxPanel(type);
}

function auxIconClass(active: boolean) {
  return cn("h-6 w-6 shrink-0", active && "bg-muted text-foreground");
}

function tabTriggerClass(tabId: string, index: number) {
  const isActive = tabId === activeId.value;
  return cn(
    "group relative inline-flex h-8 max-w-56 shrink-0 items-center gap-1.5 rounded-none px-2.5 text-[0.8125rem] font-normal leading-none transition-colors focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ring",
    isActive
      ? cn(
          "z-10 -mb-px border-x bg-background text-foreground",
          index === 0 && "border-l-0",
        )
      : "bg-transparent text-muted-foreground opacity-60",
  );
}

function tabCloseClass(tabId: string) {
  const isActive = tabId === activeId.value;
  return cn(
    "ml-0.5 shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 hover:opacity-100",
    isActive ? "opacity-50" : "group-hover:opacity-50",
  );
}

function tabTitle(tabId: string) {
  return sessions.tabCwd(tabId) ?? sessions.tabLabel(tabId);
}

function terminalRow(id: string) {
  return terminalTabs.value.find((t) => t.id === id);
}

function openResumeDialog(terminalId: string) {
  resumeDialogTerminalId.value = terminalId;
  resumeDialogOpen.value = true;
}

const splitTerminalPanelRef = ref<ComponentPublicInstance & { resize: (size: number) => void } | null>(null);

function equalizeSplitPanes() {
  splitTerminalPanelRef.value?.resize(50);
  persistSplitTerminalSize(50);
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header v-if="layoutMode === 'page'" class="flex shrink-0 items-stretch bg-sidebar">
      <div
        class="flex aspect-square shrink-0 items-stretch border-e border-border/60"
      >
        <WorkspaceSidebarToggle />
      </div>
      <div
        class="flex h-8 min-w-0 flex-1 items-stretch overflow-x-auto"
        role="tablist"
      >
        <ContextMenu v-for="(tab, index) in terminalTabItems" :key="tab.id">
          <ContextMenuTrigger as-child>
            <button
              type="button"
              role="tab"
              :class="tabTriggerClass(tab.id, index)"
              :aria-selected="tab.id === activeId"
              @click="navigateToTerminal(tab.id)"
            >
              <TerminalIcon class="size-3.5 shrink-0 opacity-70" />
              <span class="min-w-0 truncate" :title="tabTitle(tab.id)">
                {{ sessions.tabLabel(tab.id) }}
              </span>
              <span
                v-if="terminalRow(tab.id)?.agentSessionId"
                class="size-1.5 shrink-0 rounded-full bg-emerald-500"
                :title="`Agent session (${terminalRow(tab.id)?.agentKind})`"
              />
              <span
                v-if="terminalRow(tab.id)?.resumeTrusted"
                class="size-1.5 shrink-0 rounded-full bg-primary"
                title="Trusted restart command"
              />
              <span
                role="button"
                :class="tabCloseClass(tab.id)"
                :aria-label="`Close ${tab.title}`"
                @click.stop="closeTab(tab.id)"
              >
                <XIcon class="size-3" />
              </span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @select="openResumeDialog(tab.id)">
              Set restart command…
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <div class="flex shrink-0 border-s items-center gap-0 px-0.5">
        <WorkspacePanelMenu @add="addTerminal" />
        <ContextQueuePopover :queue="contextQueue" />
        <Button
          variant="ghost"
          size="icon-xs"
          :class="auxIconClass(isExplorerVisible)"
          aria-label="File explorer"
          title="File explorer"
          :aria-pressed="isExplorerVisible"
          @click="toggleAuxPanel('explorer')"
        >
          <FolderTreeIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          :class="auxIconClass(isGitVisible)"
          aria-label="Git"
          title="Git"
          :aria-pressed="isGitVisible"
          @click="toggleAuxPanel('git')"
        >
          <GitBranchIcon />
        </Button>
        <slot name="toolbar-end" />
      </div>
    </header>

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <div
        v-if="isLoading"
        class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
      >
        Loading panels…
      </div>
      <div
        v-else-if="!hasPanelContent"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <p class="text-sm">No panels in this worktree</p>
        <div class="flex items-center gap-0.5">
          <WorkspacePanelMenu @add="addTerminal" />
          <Button
            variant="ghost"
            size="icon-xs"
            :class="auxIconClass(isExplorerVisible)"
            aria-label="File explorer"
            :aria-pressed="isExplorerVisible"
            @click="toggleAuxPanel('explorer')"
          >
            <FolderTreeIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            :class="auxIconClass(isGitVisible)"
            aria-label="Git"
            :aria-pressed="isGitVisible"
            @click="toggleAuxPanel('git')"
          >
            <GitBranchIcon />
          </Button>
        </div>
      </div>
      <RouterView
        v-else-if="layoutMode === 'page'"
        :key="routerViewKey"
        class="absolute border-t inset-0"
      />
      <ResizablePanelGroup
        v-else
        direction="horizontal"
        class="absolute inset-0"
        @layout="onSplitLayout"
      >
        <ResizablePanel
          v-if="activeTerminalId"
          id="split-terminal"
          ref="splitTerminalPanelRef"
          :min-size="SPLIT_TERMINAL_MIN_SIZE"
          :default-size="splitTerminalDefaultSize"
          class="flex min-h-0 min-w-0 flex-col"
        >
          <header class="flex shrink-0 items-stretch bg-sidebar">
            <div
              class="flex aspect-square shrink-0 items-stretch border-e border-border/60"
            >
              <WorkspaceSidebarToggle />
            </div>
            <div
              class="flex h-8 min-w-0 flex-1 items-stretch overflow-x-auto"
              role="tablist"
            >
              <ContextMenu v-for="(tab, index) in terminalTabItems" :key="tab.id">
                <ContextMenuTrigger as-child>
                  <button
                    type="button"
                    role="tab"
                    :class="tabTriggerClass(tab.id, index)"
                    :aria-selected="tab.id === activeId"
                    @click="navigateToTerminal(tab.id)"
                  >
                    <TerminalIcon class="size-3.5 shrink-0 opacity-70" />
                    <span class="min-w-0 truncate" :title="tabTitle(tab.id)">
                      {{ sessions.tabLabel(tab.id) }}
                    </span>
                    <span
                      v-if="terminalRow(tab.id)?.agentSessionId"
                      class="size-1.5 shrink-0 rounded-full bg-emerald-500"
                      :title="`Agent session (${terminalRow(tab.id)?.agentKind})`"
                    />
                    <span
                      v-if="terminalRow(tab.id)?.resumeTrusted"
                      class="size-1.5 shrink-0 rounded-full bg-primary"
                      title="Trusted restart command"
                    />
                    <span
                      role="button"
                      :class="tabCloseClass(tab.id)"
                      :aria-label="`Close ${tab.title}`"
                      @click.stop="closeTab(tab.id)"
                    >
                      <XIcon class="size-3" />
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem @select="openResumeDialog(tab.id)">
                    Set restart command…
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>

            <div class="flex shrink-0 border-s items-center gap-0.5 px-1">
              <WorkspacePanelMenu @add="addTerminal" />
              <ContextQueuePopover :queue="contextQueue" />
              <Button
                variant="ghost"
                size="icon-xs"
                :class="auxIconClass(isExplorerVisible)"
                aria-label="File explorer"
                :aria-pressed="isExplorerVisible"
                @click="toggleAuxPanel('explorer')"
              >
                <FolderTreeIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                :class="auxIconClass(isGitVisible)"
                aria-label="Git"
                :aria-pressed="isGitVisible"
                @click="toggleAuxPanel('git')"
              >
                <GitBranchIcon />
              </Button>
              <slot name="toolbar-end" />
            </div>
          </header>
          <Terminal
            :key="splitTerminalKey"
            :session-id="activeTerminalId"
            class="min-h-0 flex-1 border-t"
          />
        </ResizablePanel>
        <ResizableHandle
          v-if="activeTerminalId && splitAuxPanel"
          with-handle
          @dblclick.prevent="equalizeSplitPanes"
        />
        <ResizablePanel
          v-if="splitAuxPanel === 'git'"
          id="split-git"
          :min-size="SPLIT_AUX_MIN_SIZE"
          :default-size="splitAuxDefaultSize"
          class="flex min-h-0 min-w-0 flex-col overflow-hidden"
        >
          <GitPanel :worktree-id="worktreeId" class="min-h-0 flex-1" />
        </ResizablePanel>
        <ResizablePanel
          v-else-if="splitAuxPanel === 'explorer'"
          id="split-explorer"
          :min-size="SPLIT_AUX_MIN_SIZE"
          :default-size="splitAuxDefaultSize"
          class="flex min-h-0 min-w-0 flex-col overflow-hidden"
        >
          <FileExplorerPanel :worktree-id="worktreeId" class="min-h-0 flex-1" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>

    <TerminalResumeDialog
      v-if="resumeDialogTerminalId"
      v-model:open="resumeDialogOpen"
      :terminal-id="resumeDialogTerminalId"
      :worktree-id="worktreeId"
      :initial-command="terminalRow(resumeDialogTerminalId)?.resumeCommand"
      :initial-trusted="terminalRow(resumeDialogTerminalId)?.resumeTrusted"
    />
  </div>
</template>
