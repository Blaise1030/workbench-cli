<script setup lang="ts">
import { computed } from "vue";
import { MessageCircle } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverHeader,
  PopoverTitle,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";

const props = defineProps<{
  queue: ReturnType<typeof useContextQueue>;
}>();

const open = computed({
  get: () => props.queue.popoverOpen.value,
  set: (value: boolean) => {
    props.queue.popoverOpen.value = value;
  },
});

const textModel = computed({
  get: () => props.queue.text.value,
  set: (value: string) => {
    props.queue.text.value = value;
  },
});

const hasContent = computed(() => Boolean(props.queue.text.value.trim()));

const onClear = () => {
  props.queue.clear();
  open.value = false;
};

const onSend = () => {
  props.queue.send();
  open.value = false;
};
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger
      as-child
      :class="
        Boolean(textModel)
          ? 'w-auto opacity-100'
          : 'w-0 opacity-0 overflow-hidden'
      "
    >
      <Button
        variant="ghost"
        size="icon-xs"
        class="relative"
        aria-label="Context queue"
      >
        <MessageCircle />
        <span
          v-if="hasContent"
          class="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[min(32rem,calc(100vw-2rem))] p-3" align="end">
      <PopoverHeader>
        <PopoverTitle>Context queue</PopoverTitle>
      </PopoverHeader>
      <div class="space-y-2">
        <Textarea
          v-model="textModel"
          data-native-keyboard
          class="min-h-48 font-mono text-xs resize-y"
          placeholder="Queued snippets and notes appear here…"
        />
        <div class="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" @click="onClear"> Clear </Button>
          <Button size="sm" :disabled="!queue.canSend.value" @click="onSend">
            Send to terminal
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
