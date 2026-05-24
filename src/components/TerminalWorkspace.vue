<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import {
  FolderTreeIcon,
  GitBranchIcon,
  TerminalIcon,
  XIcon,
} from "@lucide/vue";
import WorkspacePanelMenu from "@/components/WorkspacePanelMenu.vue";
import Terminal from "@/components/Terminal.vue";
import GitPanel from "@/components/GitPanel.vue";
import FileExplorerPanel from "@/components/FileExplorerPanel.vue";
import WorkspaceSidebarToggle from "@/components/WorkspaceSidebarToggle.vue";
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
import TerminalResumeDialog from "@/components/TerminalResumeDialog.vue";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  auxPanelsStateFromClient,
  clientPanelsFromState,
  loadAuxPanels,
  saveAuxPanels,
} from "@/lib/worktree-panels-storage";
import type {
  ClientWorkspacePanel,
  WorkspacePanelType,
} from "@/types/workspace-panel";

const props = defineProps<{
  worktreeId: string;
}>();

const sessions = createTerminalSessionsStore();
provide(terminalSessionsKey, sessions);

const activeId = ref("");
const clientPanels = ref<ClientWorkspacePanel[]>([]);
const resumeDialogOpen = ref(false);
const resumeDialogTerminalId = ref("");

const { data: terminals, isLoading } = useTerminalsQuery(
  () => props.worktreeId,
);
const createTerminal = useCreateTerminalMutation(() => props.worktreeId);
const deleteTerminal = useDeleteTerminalMutation(() => props.worktreeId);

const terminalTabs = computed(() => terminals.value ?? []);

const allTabs = computed(() => [
  ...terminalTabs.value.map((t) => ({
    id: t.id,
    type: "terminal" as const,
    title: sessions.tabLabel(t.id),
  })),
  ...clientPanels.value.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
  })),
]);

const activePanelType = computed((): WorkspacePanelType => {
  const tab = allTabs.value.find((t) => t.id === activeId.value);
  return tab?.type ?? "terminal";
});

watch(
  terminals,
  (list) => {
    if (!list) return;
    for (const t of list) {
      if (!sessions.get(t.id)) {
        sessions.create({
          id: t.id,
          terminalId: t.id,
          title: t.title,
        });
      }
    }
    syncActiveTab();
  },
  { immediate: true },
);

function persistPanelState() {
  saveAuxPanels(
    props.worktreeId,
    auxPanelsStateFromClient(clientPanels.value, activeId.value || null),
  );
}

function restoreClientPanels(worktreeId: string) {
  const stored = loadAuxPanels(worktreeId);
  clientPanels.value = clientPanelsFromState(worktreeId, stored);
  activeId.value = stored.activeTabId ?? "";
}

function syncActiveTab() {
  const tabs = allTabs.value;
  if (!tabs.length) {
    if (!isLoading.value) activeId.value = "";
    return;
  }
  if (tabs.some((t) => t.id === activeId.value)) return;

  const stored = loadAuxPanels(props.worktreeId).activeTabId;
  if (stored) {
    if (tabs.some((t) => t.id === stored)) {
      activeId.value = stored;
      return;
    }
    if (isLoading.value) {
      activeId.value = stored;
      return;
    }
  }

  if (isLoading.value) return;

  const firstTerminal = tabs.find((t) => t.type === "terminal");
  activeId.value = firstTerminal?.id ?? tabs[0]!.id;
}

watch(clientPanels, () => {
  persistPanelState();
  syncActiveTab();
});

watch(
  () => props.worktreeId,
  (worktreeId) => {
    restoreClientPanels(worktreeId);
    syncActiveTab();
  },
  { immediate: true },
);

watch(activeId, () => {
  persistPanelState();
});

async function addPanel(type: WorkspacePanelType) {
  if (type === "terminal") {
    const terminal = await createTerminal.mutateAsync(undefined);
    sessions.create({
      id: terminal.id,
      terminalId: terminal.id,
      title: terminal.title,
    });
    activeId.value = terminal.id;
    return;
  }

  const existing = clientPanels.value.find((p) => p.type === type);
  if (existing) {
    activeId.value = existing.id;
    return;
  }

  const restored = clientPanelsFromState(props.worktreeId, {
    ...auxPanelsStateFromClient(clientPanels.value, activeId.value || null),
    [type]: true,
  });
  clientPanels.value = restored;
  const panel = restored.find((p) => p.type === type);
  if (panel) activeId.value = panel.id;
}

async function closeTab(id: string) {
  const client = clientPanels.value.find((p) => p.id === id);
  if (client) {
    clientPanels.value = clientPanels.value.filter((p) => p.id !== id);
    persistPanelState();
    if (activeId.value === id) {
      const remaining = allTabs.value.filter((t) => t.id !== id);
      activeId.value = remaining[0]?.id ?? "";
    }
    return;
  }

  await deleteTerminal.mutateAsync(id);
  sessions.remove(id);
  if (activeId.value === id) {
    const remaining = allTabs.value.filter((t) => t.id !== id);
    activeId.value = remaining[0]?.id ?? "";
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
              @click="activeId = tab.id"
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
      <Terminal
        v-else-if="activeId && activePanelType === 'terminal'"
        :session-id="activeId"
        class="absolute inset-0"
      />
      <GitPanel
        v-else-if="activeId && activePanelType === 'git'"
        :worktree-id="worktreeId"
        class="absolute inset-0"
      />
      <FileExplorerPanel
        v-else-if="activeId && activePanelType === 'explorer'"
        :worktree-id="worktreeId"
        class="absolute inset-0"
      />
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
