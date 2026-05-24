<script setup lang="ts">
import { useRouter, useRoute, RouterView } from "vue-router";

const router = useRouter();
const route = useRoute();
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center gap-3 border-b px-4 py-3">
      <button class="text-sm hover:underline" @click="router.back()">← Back</button>
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>
    <main class="mx-auto max-w-lg p-4">
      <div class="flex gap-1 border-b mb-4">
        <button
          class="px-3 py-1.5 text-sm transition-colors"
          :class="route.name === 'settings-general'
            ? 'border-b-2 border-foreground font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'"
          @click="router.push({ name: 'settings-general' })"
        >
          General
        </button>
        <button
          class="px-3 py-1.5 text-sm transition-colors"
          :class="route.name === 'settings-network'
            ? 'border-b-2 border-foreground font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'"
          @click="router.push({ name: 'settings-network' })"
        >
          Network
        </button>
      </div>
      <RouterView />
    </main>
  </div>
</template>
