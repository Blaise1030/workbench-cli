<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import WorkspaceLayout from "@/layouts/WorkspaceLayout.vue";
import TerminalWorkspace from "@/components/TerminalWorkspace.vue";
import { projectsQueryOptions, worktreeQueryOptions } from "@/api/workspace";
import { useQuery } from "@tanstack/vue-query";
import { queryClient } from "@/lib/query-client";

const route = useRoute();
const router = useRouter();

const worktreeId = computed(() => route.params.worktreeId as string | undefined);

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
</template>
