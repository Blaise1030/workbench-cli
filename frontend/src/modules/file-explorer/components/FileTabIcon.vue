<script setup lang="ts">
import { computed } from "vue";
import { AtomIcon, FileCode2Icon, FileIcon } from "@lucide/vue";
import { basename } from "@/modules/file-explorer/lib/file-tabs";

const props = defineProps<{
  relativePath: string;
}>();

const name = computed(() => basename(props.relativePath).toLowerCase());

const badge = computed(() => {
  if (name.value.endsWith(".tsx") || name.value.endsWith(".jsx")) return null;
  if (name.value.endsWith(".ts") || name.value.endsWith(".mts")) return "TS";
  if (name.value.endsWith(".js") || name.value.endsWith(".mjs") || name.value.endsWith(".cjs"))
    return "JS";
  if (name.value.endsWith(".vue")) return "VU";
  if (name.value.endsWith(".css")) return "CS";
  if (name.value.endsWith(".json")) return "{}";
  return null;
});

const isReactish = computed(
  () => name.value.endsWith(".tsx") || name.value.endsWith(".jsx"),
);
</script>

<template>
  <AtomIcon
    v-if="isReactish"
    class="size-3.5 shrink-0 opacity-80"
    aria-hidden="true"
  />
  <span
    v-else-if="badge"
    class="flex size-3.5 shrink-0 items-center justify-center rounded-[3px] bg-muted-foreground/15 text-[0.5rem] font-semibold leading-none text-muted-foreground"
    aria-hidden="true"
  >
    {{ badge }}
  </span>
  <FileCode2Icon
    v-else-if="/\.(md|py|go|rs|rb|sh|yaml|yml|toml)$/i.test(name)"
    class="size-3.5 shrink-0 opacity-70"
    aria-hidden="true"
  />
  <FileIcon v-else class="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
</template>
