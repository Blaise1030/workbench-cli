<script setup lang="ts">
import { onMounted, watch } from "vue";

const props = defineProps<{
  collapse: () => void;
  expand: () => void;
  isCollapsed: boolean;
  storedCollapsed: boolean;
}>();

const emit = defineEmits<{
  "update:storedCollapsed": [value: boolean];
}>();

onMounted(() => {
  if (props.storedCollapsed && !props.isCollapsed) {
    props.collapse();
  }
});

watch(
  () => props.isCollapsed,
  (collapsed) => {
    if (props.storedCollapsed !== collapsed) {
      emit("update:storedCollapsed", collapsed);
    }
  },
);

defineExpose({
  collapse: () => props.collapse(),
  expand: () => props.expand(),
});
</script>

<template />
