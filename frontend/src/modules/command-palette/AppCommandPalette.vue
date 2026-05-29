<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import CommandPalette from "./CommandPalette.vue";
import { useCommandPalette } from "./useCommandPalette";
import { usePickProjectFolderMutation } from "@/modules/workspace/queries";
import { workspaceKeys } from "@/modules/workspace/queries/keys";
import { useCreateTerminalMutation, type TerminalTab } from "@/modules/terminal/queries";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";
import { isLocalHost } from "@/lib/is-local-host";
import AddProjectDialog from "@/modules/workspace/components/AddProjectDialog.vue";

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

async function handlePaletteAction(key: string) {
  if (key === "addProject") {
    if (!isLocalHost()) {
      addProjectOpen.value = true;
      return;
    }
    void pickProjectFolder.mutateAsync();
  } else if (key === "toggleTheme") {
    toggleTheme();
  } else if (key === "newTerminal") {
    const wtId = worktreeId.value;
    if (!wtId) return;
    const terminal = await createTerminal.mutateAsync(undefined);
    // Optimistically add to cache so the redirect watcher in TerminalWorkspace
    // doesn't see an unknown terminal ID and redirect away before the refetch lands.
    const cacheKey = workspaceKeys.terminals(wtId);
    const current = queryClient.getQueryData<TerminalTab[]>(cacheKey) ?? [];
    queryClient.setQueryData(cacheKey, [...current, terminal]);
    router.push({ name: "terminal", params: { worktreeId: wtId, terminalId: terminal.id } });
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
