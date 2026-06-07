<script setup lang="ts">
import { ref } from "vue";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CircleHelpIcon,
  MessageCircleIcon,
  MinusIcon,
  SettingsIcon,
  SparklesIcon,
} from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CHANGELOG_URL, type WhatsNewEntry } from "@/modules/workspace/lib/whats-new";
import { useWhatsNew } from "@/modules/workspace/hooks/use-whats-new";
import WhatsNewDialog from "@/modules/workspace/components/WhatsNewDialog.vue";

const { entries, latestEntry, dismiss } = useWhatsNew();
const dialogOpen = ref(false);
const selectedEntry = ref<WhatsNewEntry | null>(null);
const helpOpen = ref(false);

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

function openWhatsNew(e: WhatsNewEntry) {
  selectedEntry.value = e;
  dialogOpen.value = true;
  helpOpen.value = false;
}
</script>

<template>
  <div class="fixed bottom-0 left-0 z-40 p-2">
    <!-- What's new card shown when there is an undismissed entry -->
    <div
      v-if="latestEntry"
      class="group relative w-52 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-accent/40"
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

    <!-- Help button shown when all entries are dismissed -->
    <Popover v-else v-model:open="helpOpen">
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Help"
          class="text-muted-foreground hover:text-foreground"
        >
          <CircleHelpIcon class="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" class="w-52 gap-0 p-1">
        <a
          href="https://github.com/Blaise1030/workbench-cli"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          <BookOpenIcon class="size-4 shrink-0 text-muted-foreground" />
          Docs
        </a>
        <a
          href="https://github.com/Blaise1030/workbench-cli/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          <MessageCircleIcon class="size-4 shrink-0 text-muted-foreground" />
          Submit feedback
        </a>
        <RouterLink
          to="/settings"
          class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
          @click="helpOpen = false"
        >
          <SettingsIcon class="size-4 shrink-0 text-muted-foreground" />
          Settings
        </RouterLink>

        <template v-if="entries?.length">
          <div class="my-1 h-px bg-border" />

          <p class="px-2 py-1 text-[11px] text-muted-foreground">What's new</p>
          <button
            v-for="e in entries"
            :key="e.id"
            type="button"
            class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
            @click="openWhatsNew(e)"
          >
            <SparklesIcon class="size-3.5 shrink-0 text-muted-foreground" />
            {{ e.title }}
          </button>

          <div class="my-1 h-px bg-border" />
        </template>

        <a
          :href="CHANGELOG_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          <ArrowUpRightIcon class="size-4 shrink-0 text-muted-foreground" />
          Full changelog
        </a>
      </PopoverContent>
    </Popover>
  </div>

  <WhatsNewDialog v-model:open="dialogOpen" :entry="selectedEntry" />
</template>
