<script setup lang="ts">
import { computed } from "vue";
import { GitBranchIcon } from "@lucide/vue";
import {
  branchesQueryOptions,
  worktreeQueryOptions,
} from "@/api/workspace";
import { useQuery } from "@tanstack/vue-query";

const props = defineProps<{
  worktreeId: string;
}>();

const { data: worktree, isLoading } = useQuery(
  worktreeQueryOptions(() => props.worktreeId),
);

const projectId = computed(() => worktree.value?.projectId ?? "");

const { data: branches } = useQuery(
  branchesQueryOptions(() => projectId.value),
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background p-4">
    <div v-if="isLoading" class="text-sm text-muted-foreground">Loading…</div>
    <template v-else-if="worktree">
      <div class="mb-4 flex items-center gap-2 text-sm font-medium">
        <GitBranchIcon class="size-4 opacity-70" />
        <span>{{ worktree.branch ?? "detached" }}</span>
      </div>
      <p class="mb-4 font-mono text-xs text-muted-foreground break-all">
        {{ worktree.path }}
      </p>
      <section v-if="branches?.branches.length" class="min-h-0 flex-1">
        <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Branches
        </h2>
        <ul class="space-y-1 overflow-y-auto text-sm">
          <li
            v-for="branch in branches.branches"
            :key="branch"
            :class="
              branch === worktree.branch
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            "
          >
            {{ branch }}
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
