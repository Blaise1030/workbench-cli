<script setup lang="ts">
import { computed } from "vue";
import { MessageCircle } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
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
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
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
      <div class="space-y-3">
        <div>
          <p class="text-sm font-medium">Context queue</p>
          <p class="text-xs text-muted-foreground">
            Files: path:from:to · diffs: path:old:from:to or path:new:from:to
            (one side) · optional “Include code”
          </p>
        </div>
        <Textarea
          v-model="textModel"
          data-native-keyboard
          class="min-h-48 font-mono text-xs resize-y"
          placeholder="Queued snippets and notes appear here…"
        />
        <div class="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" @click="queue.clear()">
            Clear
          </Button>
          <Button
            size="sm"
            :disabled="!queue.canSend.value"
            @click="queue.send()"
          >
            Send to terminal
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
