<script setup lang="ts">
import { RouterLink } from "vue-router";
import Settings from "@/components/Settings.vue";
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center gap-3 border-b px-4 py-3">
      <RouterLink to="/" class="text-sm hover:underline">← Back</RouterLink>
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>
    <main class="mx-auto max-w-lg p-4">
      <Settings />
    </main>
  </div>
</template>
