<script setup lang="ts">
import { CodeView, type CodeViewItem, type DiffIndicators } from "@pierre/diffs";
import { useDebounceFn, useMutationObserver } from "@vueuse/core";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";

const props = defineProps<{
  items: CodeViewItem[];
  collapsedIds?: string[];
  disableBackground?: boolean;
  disableLineNumbers?: boolean;
  wordWrap?: boolean;
  diffIndicators?: DiffIndicators;
  diffStyle?: "unified" | "split";
  allCollapsed?: boolean;
}>();

const emit = defineEmits<{
  "update:collapsedIds": [ids: string[]];
}>();

const collapsedIdSet = computed(() => new Set(props.collapsedIds ?? []));

const rootRef = ref<HTMLElement | null>(null);
const viewer = shallowRef<CodeView | null>(null);
const { colorMode } = useAppColorMode();
const optionsVersion = ref(0);

const themeType = computed(() =>
  colorMode.value === "dark" ? ("dark" as const) : ("light" as const),
);

function diffOptions() {
  return {
    theme: { dark: "pierre-dark", light: "pierre-light" },
    themeType: themeType.value,
    disableBackground: props.disableBackground,
    disableLineNumbers: props.disableLineNumbers,
    overflow: props.wordWrap ? ("wrap" as const) : ("scroll" as const),
    diffIndicators: props.diffIndicators,
    diffStyle: props.diffStyle ?? "unified",
  };
}

function itemsForView() {
  const allCollapsed = props.allCollapsed === true;
  const collapsedIds = collapsedIdSet.value;
  return props.items.map((item) => ({
    ...item,
    collapsed: allCollapsed || collapsedIds.has(item.id),
  }));
}

function applyCollapsed() {
  if (props.allCollapsed === undefined) return;
  viewer.value?.setItems(itemsForView());
}

function mountViewer() {
  const root = rootRef.value;
  if (!root || viewer.value) return;

  const instance = new CodeView({
    ...diffOptions(),
    stickyHeaders: true,
    layout: { paddingTop: 8, paddingBottom: 8, gap: 8 },
  });
  instance.setup(root);
  instance.setItems(itemsForView());
  viewer.value = instance;
}

function syncItems() {
  viewer.value?.setItems(itemsForView());
}

const persistCollapsedIds = useDebounceFn(() => {
  if (!viewer.value || props.allCollapsed !== undefined) return;
  const collapsed = props.items
    .map((item) => item.id)
    .filter((id) => viewer.value?.getItem(id)?.collapsed);
  emit("update:collapsedIds", collapsed);
}, 200);

function onRootPointerUp() {
  persistCollapsedIds();
}

function syncOptions() {
  optionsVersion.value++;
  const v = optionsVersion.value;
  viewer.value?.setOptions(diffOptions());
  viewer.value?.setItems(props.items.map((item) => ({ ...item, version: v })));
}

function syncTheme() {
  syncOptions();
}

onMounted(() => {
  mountViewer();
  rootRef.value?.addEventListener("pointerup", onRootPointerUp);
});

watch(
  () => [props.items, props.collapsedIds, props.allCollapsed] as const,
  () => {
    if (viewer.value) syncItems();
    else mountViewer();
  },
  { deep: true },
);

watch(themeType, () => {
  syncTheme();
});

watch(
  () => [props.disableBackground, props.disableLineNumbers, props.wordWrap, props.diffIndicators, props.diffStyle],
  () => syncOptions(),
);

watch(
  () => props.allCollapsed,
  () => applyCollapsed(),
);

useMutationObserver(
  rootRef,
  () => {
    if (!viewer.value && rootRef.value) mountViewer();
  },
  { childList: true },
);

onBeforeUnmount(() => {
  rootRef.value?.removeEventListener("pointerup", onRootPointerUp);
  viewer.value?.cleanUp();
  viewer.value = null;
});
</script>

<template>
  <div
    ref="rootRef"
    class="git-diff-code-view min-h-0 flex-1 overflow-auto"
  />
</template>

<style>
.git-diff-code-view {
  contain: strict;
}
</style>
