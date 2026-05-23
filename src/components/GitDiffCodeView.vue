<script setup lang="ts">
import { CodeView, type CodeViewItem } from "@pierre/diffs";
import { useMutationObserver } from "@vueuse/core";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useAppColorMode } from "@/composables/useAppColorMode";

const props = defineProps<{
  items: CodeViewItem[];
}>();

const rootRef = ref<HTMLElement | null>(null);
const viewer = shallowRef<CodeView | null>(null);
const { colorMode } = useAppColorMode();

const themeType = computed(() =>
  colorMode.value === "dark" ? ("dark" as const) : ("light" as const),
);

function mountViewer() {
  const root = rootRef.value;
  if (!root || viewer.value) return;

  const instance = new CodeView({
    theme: { dark: "pierre-dark", light: "pierre-light" },
    themeType: themeType.value,
    stickyHeaders: true,
    layout: { paddingTop: 8, paddingBottom: 8, gap: 8 },
  });
  instance.setup(root);
  instance.setItems(props.items);
  viewer.value = instance;
}

function syncItems() {
  viewer.value?.setItems(props.items);
}

function syncTheme() {
  viewer.value?.setOptions({
    theme: { dark: "pierre-dark", light: "pierre-light" },
    themeType: themeType.value,
  });
  viewer.value?.render(true);
}

onMounted(() => {
  mountViewer();
});

watch(
  () => props.items,
  () => {
    if (viewer.value) syncItems();
    else mountViewer();
  },
  { deep: true },
);

watch(themeType, () => {
  syncTheme();
});

useMutationObserver(
  rootRef,
  () => {
    if (!viewer.value && rootRef.value) mountViewer();
  },
  { childList: true },
);

onBeforeUnmount(() => {
  viewer.value?.cleanUp();
  viewer.value = null;
});
</script>

<template>
  <div
    ref="rootRef"
    class="git-diff-code-view min-h-0 flex-1 overflow-auto rounded-md border border-border/60 bg-muted/20"
  />
</template>

<style>
.git-diff-code-view {
  contain: strict;
}
</style>
