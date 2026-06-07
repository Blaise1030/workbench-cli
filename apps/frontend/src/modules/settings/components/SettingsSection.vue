<script setup lang="ts">
import { Item, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";

defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <section class="border-b border-border px-8 py-6 last:border-b-0">
    <div class="mx-auto w-full max-w-3xl">
      <Item variant="default">
        <ItemContent class="gap-0">
          <ItemTitle>{{ title }}</ItemTitle>
          <ItemDescription v-if="description">{{ description }}</ItemDescription>
        </ItemContent>
      </Item>
      <div class="divide-y divide-border">
        <slot />
      </div>
    </div>
  </section>
</template>
