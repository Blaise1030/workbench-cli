<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <section class="border-b border-border px-8 py-6 last:border-b-0">
    <div class="mb-4 space-y-1">
      <h2 class="text-sm font-medium">{{ title }}</h2>
      <p v-if="description" class="text-sm text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div class="divide-y divide-border">
      <slot />
    </div>
  </section>
</template>
