<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import {
  FolderTreeIcon,
  GitBranchIcon,
  TerminalIcon,
  XIcon,
} from "@lucide/vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import WorkspacePanelMenu from "@/modules/workspace/components/WorkspacePanelMenu.vue";
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
  createTerminalSessionsStore,
  terminalSessionsKey,
} from "@/modules/terminal/hooks/terminal-sessions";
import {
  useCreateTerminalMutation,
  useDeleteTerminalMutation,
  useTerminalsQuery,
} from "@/modules/terminal/queries";
import {
  GIT_PANEL_DEFAULT_TAB,
  useGitPanelStorage,
  isGitPanelTabScope,
} from "@/modules/git/lib/git-panel-storage";
import {
  useWorktreePanels,
  gitPanelId,
  explorerPanelId,
  type WorktreeLastRoute,
} from "@/modules/workspace/lib/worktree-panels-storage";
import { useWorkspaceKeybindings } from "@/modules/keyboard/hooks/useWorkspaceKeybindings";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();
const sessions = createTerminalSessionsStore();
provide(terminalSessionsKey, sessions);

const panelsState = useWorktreePanels(() => props.worktreeId);
const gitPanelState = useGitPanelStorage(() => props.worktreeId);

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

const hasPanelContent = computed(
  () =>
    terminalTabItems.value.length > 0 ||
    route.name === "git" ||
    route.name === "explorer",
);

const activeId = computed(() => {
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
    panelsState.value = {
      ...panelsState.value,
      git: true,
      lastRoute: "git",
    };
    return;
  }
  if (name === "explorer") {
    panelsState.value = {
      ...panelsState.value,
      explorer: true,
      lastRoute: "explorer",
    };
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

  if (lastRoute === "git" && state.git) {
    const tab = gitPanelState.value.activeTab;
    router.replace({
      name: "git",
      params: { worktreeId: props.worktreeId },
      query: {
        tab: isGitPanelTabScope(tab) ? tab : GIT_PANEL_DEFAULT_TAB,
      },
    });
    return;
  }

  if (lastRoute === "explorer" && state.explorer) {
    router.replace({
      name: "explorer",
      params: { worktreeId: props.worktreeId },
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

async function addTerminal() {
  const terminal = await createTerminal.mutateAsync(undefined);
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
  if (type === "git") {
    panelsState.value.git = true;
    router.push({ name: "git", params: { worktreeId: props.worktreeId } });
    return;
  }
  panelsState.value.explorer = true;
  router.push({ name: "explorer", params: { worktreeId: props.worktreeId } });
}

useWorkspaceKeybindings({
  terminalTabItems,
  navigateToTerminal,
  addTerminal,
  openAuxPanel,
});

async function closeTab(id: string) {
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
  const isActive =
    type === "git" ? route.name === "git" : route.name === "explorer";

  if (isActive) {
    if (type === "git") panelsState.value.git = false;
    else panelsState.value.explorer = false;
    navigateToFirstTerminal();
    return;
  }

  openAuxPanel(type);
}

function auxIconClass(active: boolean) {
  return cn(
    "h-6 w-6 shrink-0 rounded-none",
    active && "bg-muted text-foreground",
  );
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
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
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
        <Button
          variant="ghost"
          size="icon-xs"
          :class="auxIconClass(route.name === 'explorer')"
          aria-label="File explorer"
          :aria-pressed="route.name === 'explorer'"
          @click="toggleAuxPanel('explorer')"
        >
          <FolderTreeIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          :class="auxIconClass(route.name === 'git')"
          aria-label="Git"
          :aria-pressed="route.name === 'git'"
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
            :class="auxIconClass(route.name === 'explorer')"
            aria-label="File explorer"
            :aria-pressed="route.name === 'explorer'"
            @click="toggleAuxPanel('explorer')"
          >
            <FolderTreeIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            :class="auxIconClass(route.name === 'git')"
            aria-label="Git"
            :aria-pressed="route.name === 'git'"
            @click="toggleAuxPanel('git')"
          >
            <GitBranchIcon />
          </Button>
        </div>
      </div>
      <RouterView v-else class="absolute border-t inset-0" />
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
