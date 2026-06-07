<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div :class="cn('relative flex h-full w-full flex-1 flex-col overflow-hidden', $props.class)">
    <span class="terminal-cursor absolute left-2 top-2 inline-block h-3.5 w-2 bg-foreground/50" />
  </div>
</template>

<style scoped>
.terminal-cursor {
  animation: terminal-blink 1s step-end infinite;
}

@keyframes terminal-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
