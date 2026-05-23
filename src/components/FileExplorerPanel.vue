<script setup lang="ts">
import { FolderTreeIcon } from "@lucide/vue";
import { worktreeQueryOptions } from "@/api/workspace";
import { useQuery } from "@tanstack/vue-query";

const props = defineProps<{
  worktreeId: string;
}>();

const { data: worktree, isLoading } = useQuery(
  worktreeQueryOptions(() => props.worktreeId),
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-background p-6 text-center">
    <FolderTreeIcon class="size-10 text-muted-foreground/50" />
    <div v-if="isLoading" class="text-sm text-muted-foreground">Loading…</div>
    <template v-else-if="worktree">
      <p class="text-sm font-medium">File explorer</p>
      <p class="max-w-md font-mono text-xs text-muted-foreground break-all">
        {{ worktree.path }}
      </p>
      <p class="max-w-sm text-xs text-muted-foreground">
        Browse this worktree on disk. A full tree view will plug in here next.
      </p>
    </template>
  </div>
</template>
