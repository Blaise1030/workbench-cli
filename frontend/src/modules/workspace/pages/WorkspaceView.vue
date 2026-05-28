<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useColorMode } from "@vueuse/core";
import WorkspaceLayout from "@/modules/workspace/layout/WorkspaceLayout.vue";
import TerminalWorkspace from "@/modules/terminal/layout/TerminalWorkspace.vue";
import CommandPalette from "@/modules/command-palette/CommandPalette.vue";
import { useCommandPalette } from "@/modules/command-palette/useCommandPalette";
import {
  projectsQueryOptions,
  usePickProjectFolderMutation,
  worktreeQueryOptions,
} from "@/modules/workspace/queries";
import { useQuery } from "@tanstack/vue-query";
import { queryClient } from "@/lib/query-client";
import { useGlobalWorkspaceKeybindings } from "@/modules/keyboard/hooks/useGlobalWorkspaceKeybindings";

const route = useRoute();
const router = useRouter();

const worktreeId = computed(() => route.params.worktreeId as string | undefined);

useGlobalWorkspaceKeybindings(worktreeId);

const { isOpen } = useCommandPalette();
const pickProjectFolder = usePickProjectFolderMutation();
const colorMode = useColorMode();

function handlePaletteAction(key: string) {
  if (key === "addProject") {
    void pickProjectFolder.mutateAsync();
  } else if (key === "toggleTheme") {
    colorMode.value = colorMode.value === "dark" ? "light" : "dark";
  }
}

const { data: projects } = useQuery(projectsQueryOptions());

watch(
  [projects, worktreeId],
  async ([list, id]) => {
    if (id || route.name !== "home") return;
    if (!list?.length) return;
    const last = localStorage.getItem("lastWorktreeId");
    if (!last) return;
    try {
      await queryClient.ensureQueryData(worktreeQueryOptions(last));
      await router.replace({ name: "workspace", params: { worktreeId: last } });
    } catch {
      localStorage.removeItem("lastWorktreeId");
    }
  },
  { immediate: true },
);
</script>

<template>
  <WorkspaceLayout :active-worktree-id="worktreeId">
    <TerminalWorkspace
      v-if="worktreeId"
      :worktree-id="worktreeId"
      class="flex min-h-0 flex-1 flex-col"
    >
    </TerminalWorkspace>

    <div v-else class="flex h-full min-h-0 flex-1 flex-col">
      <header class="flex h-8 shrink-0 items-stretch border-b bg-muted">
        <WorkspaceSidebarToggle />
      </header>
      <div
        class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
      >
        <p class="text-sm">Select a worktree from the sidebar</p>
        <p class="text-xs">or add a project to begin</p>
      </div>
    </div>
  </WorkspaceLayout>

  <CommandPalette
    :open="isOpen"
    :worktree-id="worktreeId"
    @update:open="(v) => { isOpen.value = v }"
    @action="handlePaletteAction"
  />
</template>
