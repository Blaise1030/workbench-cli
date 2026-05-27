<script setup lang="ts">
defineProps<{
  label: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex items-center justify-between gap-8 py-4">
    <div class="min-w-0 flex-1 space-y-1">
      <div class="text-sm font-medium">{{ label }}</div>
      <p v-if="description" class="text-sm text-muted-foreground">
        {{ description }}
      </p>
      <slot name="hint" />
    </div>
    <div class="flex shrink-0 items-center">
      <slot />
    </div>
  </div>
</template>
