<script setup lang="ts">
import { ref } from "vue";
import { MinusIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { useWhatsNew } from "@/modules/workspace/hooks/use-whats-new";
import type { WhatsNewEntry } from "@/modules/workspace/lib/whats-new";
import WhatsNewDialog from "@/modules/workspace/components/WhatsNewDialog.vue";

const { latestEntry, dismiss } = useWhatsNew();

const dialogOpen = ref(false);
const selectedEntry = ref<WhatsNewEntry | null>(null);

function dismissCurrent(event?: MouseEvent) {
  event?.stopPropagation();
  if (!latestEntry.value) return;
  dismiss(latestEntry.value.id);
  dialogOpen.value = false;
}

function openDetails() {
  if (!latestEntry.value) return;
  selectedEntry.value = latestEntry.value;
  dialogOpen.value = true;
}
</script>

<template>
  <div v-if="latestEntry" class="px-2 pb-2">
    <div
      class="group relative w-full rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-accent/40"
    >
      <Button
        variant="ghost"
        size="icon-xs"
        class="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss update"
        @click="dismissCurrent"
      >
        <MinusIcon class="size-3.5" />
      </Button>

      <button
        type="button"
        class="block w-full pr-6 text-left"
        @click="openDetails"
      >
        <p class="text-[11px] leading-none text-muted-foreground">
          What's new
        </p>
        <p class="mt-1.5 truncate text-sm font-medium text-foreground">
          {{ latestEntry.title }}
        </p>
      </button>
    </div>
  </div>

  <WhatsNewDialog
    v-model:open="dialogOpen"
    :entry="selectedEntry"
  />
</template>
