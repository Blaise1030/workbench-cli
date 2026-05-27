<script setup lang="ts">
import { PlusIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";

const emit = defineEmits<{
  add: [];
}>();
</script>

<template>
  <Button
    variant="ghost"
    size="icon-xs"
    class="h-6 w-6 shrink-0 rounded-none"
    aria-label="Add terminal"
    @click="emit('add')"
  >
    <PlusIcon />
  </Button>
</template>
