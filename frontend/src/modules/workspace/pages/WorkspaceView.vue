<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import WorkspaceLayout from "@/modules/workspace/layout/WorkspaceLayout.vue";
import TerminalWorkspace from "@/modules/terminal/layout/TerminalWorkspace.vue";
import WorkspaceSidebarToggle from "@/modules/workspace/components/WorkspaceSidebarToggle.vue";
import {
  projectsQueryOptions,
  worktreeQueryOptions,
} from "@/modules/workspace/queries";
import { useQuery } from "@tanstack/vue-query";
import { queryClient } from "@/lib/query-client";
import { useGlobalWorkspaceKeybindings } from "@/modules/keyboard/hooks/useGlobalWorkspaceKeybindings";
import { GitBranchIcon } from "@lucide/vue";
import { EmptyState } from "@/modules/empty-states";

const route = useRoute();
const router = useRouter();

const worktreeId = computed(() => route.params.worktreeId as string | undefined);

watch(
  worktreeId,
  (id) => {
    if (id) localStorage.setItem("lastWorktreeId", id);
  },
  { immediate: true },
);

useGlobalWorkspaceKeybindings(worktreeId);

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

    <div v-else class="flex min-h-0 flex-1 flex-col">
      <header class="flex h-8 shrink-0 items-center border-b bg-sidebar px-1">
        <WorkspaceSidebarToggle />
      </header>
      <div class="relative min-h-0 flex-1 overflow-hidden">
        <EmptyState
          class="absolute inset-0"
          :icon="GitBranchIcon"
          title="Select a worktree from the sidebar"
          description="or add a project to begin"
        />
      </div>
    </div>
  </WorkspaceLayout>
</template>
