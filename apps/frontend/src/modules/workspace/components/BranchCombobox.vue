<script setup lang="ts">
import { ref } from "vue";
import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon } from "@lucide/vue";
import IsoSearchOff from "@/assets/isocons/IsoSearchOff.vue";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxViewport,
} from "@/components/ui/combobox";

const props = defineProps<{
  branches: string[];
  placeholder?: string;
  disabled?: boolean;
  listClass?: string;
}>();

const model = defineModel<string>({ default: "" });
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <Combobox
    v-model="model"
    v-model:open="open"
    :filter-function="(list, term) => (list as string[]).filter(b => b.toLowerCase().includes(term.toLowerCase()))"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child>
        <slot name="trigger">
          <Button variant="outline" size="sm" class="w-full justify-between">
            <span class="flex min-w-0 items-center gap-2">
              <GitBranchIcon class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="truncate">{{ model || placeholder || 'Select branch' }}</span>
            </span>
            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
          </Button>
        </slot>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxList align="start" :side-offset="4" :class="listClass ?? 'w-[var(--reka-combobox-trigger-width)]'">
      <div class="px-2 pt-2">
        <ComboboxInput placeholder="Search branches..." auto-focus group-class="bg-input" />
      </div>
      <ComboboxViewport class="max-h-48">
        <ComboboxEmpty class="flex-col items-center gap-2">
          <IsoSearchOff class="size-10 text-muted-foreground" />
          No branch found
        </ComboboxEmpty>
        <ComboboxItem
          v-for="branch in branches"
          :key="branch"
          :value="branch"
          :disabled="disabled"
          class="py-1 text-sm"
        >
          <CheckIcon
            class="size-3.5 shrink-0"
            :class="branch === model ? 'opacity-100' : 'opacity-0'"
          />
          <span class="truncate" :title="branch">{{ branch }}</span>
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxList>
  </Combobox>
</template>
