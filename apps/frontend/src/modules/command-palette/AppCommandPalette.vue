<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import CommandPalette from "./CommandPalette.vue";
import { useCommandPalette } from "./useCommandPalette";
import { usePickProjectFolderMutation } from "@/modules/workspace/queries";
import { workspaceKeys } from "@/modules/workspace/queries/keys";
import {
  useCreateTerminalMutation,
  type CreateTerminalInput,
  type TerminalTab,
} from "@/modules/terminal/queries";
import { agentsQueryKeys } from "@/modules/settings/queries/agents";
import type { AgentsResponse } from "@/modules/settings/types/agents";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";
import { isLocalHost } from "@/lib/is-local-host";
import AddProjectDialog from "@/modules/workspace/components/AddProjectDialog.vue";
import { openProjectWorkspace } from "@/modules/workspace/lib/open-project-workspace";
import { toast } from "vue-sonner";
import { useWorktreeLayoutMode } from "@/modules/workspace/hooks/use-worktree-layout-mode";
import {
  activateDefaultSplitAuxPanel,
  useWorktreePanels,
} from "@/modules/workspace/lib/worktree-panels-storage";

const route = useRoute();
const router = useRouter();
const { isOpen } = useCommandPalette();

function setPaletteOpen(value: boolean) {
  isOpen.value = value;
}

const pickProjectFolder = usePickProjectFolderMutation();
const { toggleTheme } = useAppColorMode();
const addProjectOpen = ref(false);

const worktreeId = computed(() => route.params.worktreeId as string | undefined);
const createTerminal = useCreateTerminalMutation(worktreeId);
const queryClient = useQueryClient();
const worktreeLayout = useWorktreeLayoutMode(() => worktreeId.value ?? "");
const panelsState = useWorktreePanels(() => worktreeId.value ?? "");

async function navigateToNewTerminal(input?: CreateTerminalInput) {
  const wtId = worktreeId.value;
  if (!wtId) return;
  const terminal = await createTerminal.mutateAsync(input);
  const cacheKey = workspaceKeys.terminals(wtId);
  const current = queryClient.getQueryData<TerminalTab[]>(cacheKey) ?? [];
  queryClient.setQueryData(cacheKey, [...current, terminal]);
  router.push({ name: "terminal", params: { worktreeId: wtId, terminalId: terminal.id } });
}

async function handlePaletteAction(key: string) {
  if (key === "addProject") {
    if (!isLocalHost()) {
      addProjectOpen.value = true;
      return;
    }
    try {
      const result = await pickProjectFolder.mutateAsync();
      if (result.cancelled) return;
      try {
        await openProjectWorkspace(queryClient, router, result.project);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to open project workspace",
        );
      }
    } catch {
      // handled by mutation onError (toast)
    }
  } else if (key === "toggleTheme") {
    toggleTheme();
  } else if (key === "newTerminal") {
    await navigateToNewTerminal();
  } else if (key.startsWith("newTerminal:agent:")) {
    const agentId = key.slice("newTerminal:agent:".length);
    const settings = queryClient.getQueryData<AgentsResponse>(agentsQueryKeys.all);
    const agent = settings?.agents.find((a) => a.id === agentId);
    if (!agent) {
      toast.error("Agent not found");
      return;
    }
    await navigateToNewTerminal({
      title: agent.name,
      launchCommand: agent.startCommand,
    });
  } else if (key === "activateSplitLayout") {
    if (!worktreeId.value) return;
    if (worktreeLayout.layoutMode.value !== "split") {
      panelsState.value = activateDefaultSplitAuxPanel(panelsState.value);
    }
    worktreeLayout.toggleLayoutMode();
  }
}
</script>

<template>
  <CommandPalette
    :open="isOpen"
    :worktree-id="worktreeId"
    @update:open="setPaletteOpen"
    @action="handlePaletteAction"
  />
  <AddProjectDialog v-model:open="addProjectOpen" />
</template>
