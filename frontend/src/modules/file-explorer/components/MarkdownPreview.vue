<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const props = defineProps<{
  content: string;
}>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
}).enable("table");

const rendered = computed(() =>
  DOMPurify.sanitize(md.render(props.content)),
);
</script>

<template>
  <div class="markdown-preview min-h-0 flex-1 overflow-auto px-6 py-4" v-html="rendered" />
</template>

<style scoped>
@reference "../../../assets/index.css";

.markdown-preview :deep(h1) { @apply text-2xl font-bold mt-6 mb-3 pb-1 border-b border-border; }
.markdown-preview :deep(h2) { @apply text-xl font-semibold mt-5 mb-2 pb-1 border-b border-border; }
.markdown-preview :deep(h3) { @apply text-lg font-semibold mt-4 mb-2; }
.markdown-preview :deep(h4) { @apply text-base font-semibold mt-3 mb-1; }
.markdown-preview :deep(p) { @apply my-3 leading-relaxed text-sm; }
.markdown-preview :deep(ul) { @apply my-3 ml-5 list-disc text-sm; }
.markdown-preview :deep(ol) { @apply my-3 ml-5 list-decimal text-sm; }
.markdown-preview :deep(li) { @apply my-1; }
.markdown-preview :deep(a) { @apply text-primary underline underline-offset-2; }
.markdown-preview :deep(blockquote) { @apply border-l-4 border-border pl-4 my-3 text-muted-foreground italic text-sm; }
.markdown-preview :deep(code) { @apply bg-muted text-foreground rounded px-1 py-0.5 text-[0.8rem] font-mono; }
.markdown-preview :deep(pre) { @apply bg-muted rounded-md p-4 my-3 overflow-x-auto text-sm; }
.markdown-preview :deep(pre code) { @apply bg-transparent p-0; }
.markdown-preview :deep(hr) { @apply border-border my-6; }
.markdown-preview :deep(img) { @apply max-w-full rounded-md my-3; }
.markdown-preview :deep(table) { @apply w-full text-sm my-3 border-collapse; }
.markdown-preview :deep(th) { @apply border border-border px-3 py-1.5 text-left font-semibold bg-muted; }
.markdown-preview :deep(td) { @apply border border-border px-3 py-1.5; }
.markdown-preview :deep(tr:nth-child(even) td) { @apply bg-muted/40; }
</style>
