<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import {
  FolderTreeIcon,
  GitBranchIcon,
  TerminalIcon,
  XIcon,
} from "@lucide/vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import WorkspacePanelMenu from "@/components/WorkspacePanelMenu.vue";
import WorkspaceSidebarToggle from "@/components/WorkspaceSidebarToggle.vue";
import TerminalResumeDialog from "@/components/TerminalResumeDialog.vue";
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
} from "@/composables/terminal-sessions";
import {
  useCreateTerminalMutation,
  useDeleteTerminalMutation,
  useTerminalsQuery,
} from "@/api/workspace";
import {
  useWorktreePanels,
  clientPanelsFromState,
  gitPanelId,
  explorerPanelId,
} from "@/lib/worktree-panels-storage";
import type { WorkspacePanelType } from "@/types/workspace-panel";

const props = defineProps<{
  worktreeId: string;
}>();

const route = useRoute();
const router = useRouter();
const sessions = createTerminalSessionsStore();
provide(terminalSessionsKey, sessions);

const panelsState = useWorktreePanels(() => props.worktreeId);

const { data: terminals, isLoading } = useTerminalsQuery(
  () => props.worktreeId,
);
const createTerminal = useCreateTerminalMutation(() => props.worktreeId);
const deleteTerminal = useDeleteTerminalMutation(() => props.worktreeId);

const terminalTabs = computed(() => terminals.value ?? []);

const clientPanels = computed(() =>
  clientPanelsFromState(props.worktreeId, panelsState.value),
);

const allTabs = computed(() => [
  ...terminalTabs.value.map((t) => ({
    id: t.id,
    type: "terminal" as const,
    title: sessions.tabLabel(t.id),
  })),
  ...clientPanels.value.map((p) => ({
    id: p.id,
    type: p.type as WorkspacePanelType,
    title: p.title,
  })),
]);

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

// Redirect if current terminal no longer exists
watch(
  [terminals, () => route.params.terminalId],
  ([list, terminalId]) => {
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
  },
);

function navigateTo(tab: { id: string; type: WorkspacePanelType }) {
  if (tab.type === "terminal") {
    router.push({ name: "terminal", params: { worktreeId: props.worktreeId, terminalId: tab.id } });
  } else if (tab.type === "git") {
    router.push({ name: "git", params: { worktreeId: props.worktreeId } });
  } else if (tab.type === "explorer") {
    router.push({ name: "explorer", params: { worktreeId: props.worktreeId } });
  }
}

async function addPanel(type: WorkspacePanelType) {
  if (type === "terminal") {
    const terminal = await createTerminal.mutateAsync(undefined);
    sessions.create({ id: terminal.id, terminalId: terminal.id, title: terminal.title });
    router.push({ name: "terminal", params: { worktreeId: props.worktreeId, terminalId: terminal.id } });
    return;
  }
  if (type === "git") {
    panelsState.value.git = true;
    router.push({ name: "git", params: { worktreeId: props.worktreeId } });
    return;
  }
  if (type === "explorer") {
    panelsState.value.explorer = true;
    router.push({ name: "explorer", params: { worktreeId: props.worktreeId } });
  }
}

async function closeTab(id: string) {
  const isActive = id === activeId.value;
  const remaining = allTabs.value.filter((t) => t.id !== id);

  const clientPanel = clientPanels.value.find((p) => p.id === id);
  if (clientPanel) {
    if (clientPanel.type === "git") panelsState.value.git = false;
    else if (clientPanel.type === "explorer") panelsState.value.explorer = false;
  } else {
    await deleteTerminal.mutateAsync(id);
    sessions.remove(id);
  }

  if (isActive && remaining[0]) {
    navigateTo(remaining[0] as { id: string; type: WorkspacePanelType });
  }
}

function tabIcon(type: WorkspacePanelType) {
  if (type === "git") return GitBranchIcon;
  if (type === "explorer") return FolderTreeIcon;
  return TerminalIcon;
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
      : "bg-transparent text-muted-foreground",
  );
}

function tabCloseClass(tabId: string) {
  const isActive = tabId === activeId.value;
  return cn(
    "ml-0.5 shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 hover:opacity-100",
    isActive ? "opacity-50" : "group-hover:opacity-50",
  );
}

function tabTitle(tab: { id: string; type: WorkspacePanelType; title: string }) {
  if (tab.type === "terminal") {
    return sessions.tabCwd(tab.id) ?? sessions.tabLabel(tab.id);
  }
  return tab.title;
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
    <header class="flex shrink-0 items-stretch bg-muted">
      <div class="flex aspect-square shrink-0 items-stretch border-e border-border/60">
        <WorkspaceSidebarToggle />
      </div>
      <div
        class="flex h-8 min-w-0 flex-1 items-stretch overflow-x-auto"
        role="tablist"
      >
        <ContextMenu v-for="(tab, index) in allTabs" :key="tab.id">
          <ContextMenuTrigger as-child>
            <button
              type="button"
              role="tab"
              :class="tabTriggerClass(tab.id, index)"
              :aria-selected="tab.id === activeId"
              @click="navigateTo(tab)"
            >
              <component :is="tabIcon(tab.type)" class="size-3.5 shrink-0 opacity-70" />
              <span class="min-w-0 truncate" :title="tabTitle(tab)">
                {{
                  tab.type === "terminal"
                    ? sessions.tabLabel(tab.id)
                    : tab.title
                }}
              </span>
              <span
                v-if="tab.type === 'terminal' && terminalRow(tab.id)?.agentSessionId"
                class="size-1.5 shrink-0 rounded-full bg-emerald-500"
                :title="`Agent session (${terminalRow(tab.id)?.agentKind})`"
              />
              <span
                v-if="tab.type === 'terminal' && terminalRow(tab.id)?.resumeTrusted"
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
          <ContextMenuContent v-if="tab.type === 'terminal'">
            <ContextMenuItem @select="openResumeDialog(tab.id)">
              Set restart command…
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <div class="flex shrink-0 border-s items-center gap-0.5 px-1">
        <WorkspacePanelMenu @add="addPanel" />
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
        v-else-if="!allTabs.length"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <p class="text-sm">No panels in this worktree</p>
        <WorkspacePanelMenu @add="addPanel" />
      </div>
      <RouterView v-else class="absolute inset-0" />
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
