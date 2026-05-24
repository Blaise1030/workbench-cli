<script setup lang="ts">
import { inject, onMounted, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import {
  workspaceSidebarKey,
  type WorkspaceSidebarPanelApi,
} from "@/modules/workspace/hooks/workspace-sidebar";

const STORAGE_KEY_COLLAPSED = "lan-terminal:workspace-sidebar-collapsed";

const props = defineProps<WorkspaceSidebarPanelApi & { isCollapsed: boolean }>();

const store = inject(workspaceSidebarKey);
if (!store) {
  throw new Error(
    "WorkspaceSidebarPanelBridge requires WorkspaceLayout provider",
  );
}

const sidebarCollapsed = useLocalStorage(STORAGE_KEY_COLLAPSED, false);

onMounted(() => {
  store.bindPanel({
    collapse: props.collapse,
    expand: props.expand,
  });

  if (sidebarCollapsed.value) {
    props.collapse();
  }
});

watch(
  () => props.isCollapsed,
  (collapsed) => {
    store.isCollapsed.value = collapsed;
    sidebarCollapsed.value = collapsed;
  },
  { immediate: true },
);
</script>

<template />
