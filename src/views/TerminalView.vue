<script setup lang="ts">
import { RouterLink } from "vue-router";
import Terminal from "@/components/Terminal.vue";
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex shrink-0 items-center justify-between border-b px-3 py-2">
      <span class="text-sm text-muted-foreground">lan-terminal</span>
      <RouterLink to="/settings" class="text-sm hover:underline">Settings</RouterLink>
    </header>
    <Terminal class="min-h-0 flex-1" />
  </div>
</template>
