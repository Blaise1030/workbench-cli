<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-col">
    <header class="shrink-0 pt-12">
      <div class="mx-auto flex w-full px-3 max-w-3xl items-start justify-between gap-4">
        <div class="min-w-0 space-y-1">
          <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
          <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
    </header>
    <div class="flex flex-1 flex-col">
      <slot />
    </div>
  </div>
</template>
