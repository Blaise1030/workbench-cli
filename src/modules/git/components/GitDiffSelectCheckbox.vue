<script setup lang="ts">
import { Checkbox } from "@/components/ui/checkbox";

defineProps<{
  checked: boolean;
  filePath?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:checked": [value: boolean];
}>();
</script>

<template>
  <Checkbox
    :model-value="checked"
    :disabled="disabled"
    :aria-label="filePath ? `Select ${filePath}` : 'Select file'"
    @update:model-value="
      (value) => value !== 'indeterminate' && emit('update:checked', value === true)
    "
    @click.stop
  />
</template>
