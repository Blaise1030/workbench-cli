<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 text-muted-foreground">
    <component :is="icon" v-if="icon" class="size-8 opacity-30" />
    <div class="flex flex-col items-center gap-1 text-center">
      <p class="text-sm font-medium">{{ title }}</p>
      <p v-if="description" class="text-xs opacity-60">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
