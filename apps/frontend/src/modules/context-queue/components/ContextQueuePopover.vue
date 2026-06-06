<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";

const route = useRoute();

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

const isTerminalRoute = computed(() => route.name === "terminal");

const sendEnabled = computed(
  () => isTerminalRoute.value && props.queue.canSend.value,
);

const sendTooltip = computed(() => {
  if (!isTerminalRoute.value) return "Switch to a terminal tab to send";
  if (sendEnabled.value) return null;
  if (!props.queue.text.value.trim()) return "Add content to the queue first";
  return "Open a terminal first";
});

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
    <PopoverTrigger as-child>
      <Button
        class="relative"
        :class="
          Boolean(textModel)
            ? 'w-auto opacity-100'
            : 'w-0 opacity-0 overflow-hidden'
        "
        variant="ghost"
        size="icon-xs"
        aria-label="Context queue"
      >
        <MessageCircle />
        <span
          v-if="hasContent"
          class="absolute top-0.5 -right-0.5 size-1.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      class="flex w-[min(32rem,calc(100vw-2rem))] max-h-[min(40rem,calc(100dvh-4rem))] flex-col gap-2 overflow-hidden p-3"
      align="end"
    >
      <PopoverHeader class="flex shrink-0 flex-row items-center justify-between">
        <PopoverTitle>Context queue</PopoverTitle>
        <div class="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" @click="onClear"> Clear </Button>
          <TooltipProvider v-if="sendTooltip">
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="inline-flex">
                  <Button size="sm" disabled> Send to terminal </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {{ sendTooltip }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button v-else size="sm" @click="onSend"> Send to terminal </Button>
        </div>
      </PopoverHeader>
      <Textarea
        v-model="textModel"
        data-native-keyboard
        class="min-h-48 max-h-[min(28rem,calc(100dvh-11rem))] overflow-y-auto field-sizing-fixed resize-y font-mono text-xs"
        placeholder="Queued snippets and notes appear here…"
      />
    </PopoverContent>
  </Popover>
</template>
