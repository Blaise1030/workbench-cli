<script setup lang="ts">
import { ref } from "vue";
import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
  ComboboxViewport,
} from "@/components/ui/combobox";

const props = defineProps<{
  branches: string[];
  placeholder?: string;
}>();

const model = defineModel<string>({ default: "" });
const open = ref(false);
</script>

<template>
  <Combobox v-model="model" v-model:open="open" :filter-function="(list, term) => (list as string[]).filter(b => b.toLowerCase().includes(term.toLowerCase()))">
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child>
        <Button variant="outline" size="sm" class="w-full justify-between">
          <span class="flex min-w-0 items-center gap-2">
            <GitBranchIcon class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ model || placeholder || 'Select branch' }}</span>
          </span>
          <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
        </Button>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxList align="start" :side-offset="4" class="w-[var(--reka-combobox-trigger-width)]">
      <ComboboxInput placeholder="Search branch..." auto-focus />
      <ComboboxViewport>
        <ComboboxEmpty>No branch found</ComboboxEmpty>
        <ComboboxItem
          v-for="branch in branches"
          :key="branch"
          :value="branch"
        >
          <GitBranchIcon class="size-3.5 text-muted-foreground" />
          {{ branch }}
          <ComboboxItemIndicator class="absolute right-2">
            <CheckIcon class="size-4" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxList>
  </Combobox>
</template>
