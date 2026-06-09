<script setup lang="ts">
import { Item, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";

defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <section class="px-8 py-6">
    <div class="mx-auto w-full max-w-3xl">
      <Item variant="default">
        <ItemContent class="gap-0">
          <ItemTitle>{{ title }}</ItemTitle>
          <ItemDescription v-if="description">{{ description }}</ItemDescription>
        </ItemContent>
        <ItemActions v-if="$slots.actions">
          <slot name="actions" />
        </ItemActions>
      </Item>
      <div class="divide-y divide-border">
        <slot />
      </div>
    </div>
  </section>
</template>
