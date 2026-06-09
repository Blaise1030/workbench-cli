<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  worktreeId: string;
  relativePath: string;
}>();

const src = computed(
  () =>
    `/api/worktrees/${props.worktreeId}/files/raw?path=${encodeURIComponent(props.relativePath)}`,
);
</script>

<template>
  <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
    <img
      :src="src"
      :alt="relativePath"
      class="max-h-full max-w-full rounded-md object-contain"
    />
  </div>
</template>
