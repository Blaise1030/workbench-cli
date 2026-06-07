<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowUpRightIcon,
  BotIcon,
  FolderOpenIcon,
  XIcon,
} from "@lucide/vue";
import type { LucideIcon } from "@lucide/vue";
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "reka-ui";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import {
  CHANGELOG_URL,
  formatReleaseDate,
  type WhatsNewEntry,
} from "@/modules/workspace/lib/whats-new";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  entry: WhatsNewEntry | null;
}>();

const heroIcons: Record<NonNullable<WhatsNewEntry["heroIcon"]>, LucideIcon> = {
  bot: BotIcon,
  folder: FolderOpenIcon,
};

const HeroIcon = computed(() => {
  const key = props.entry?.heroIcon;
  return key ? heroIcons[key] : BotIcon;
});

const publishedLabel = computed(() => {
  if (!props.entry) return "";
  return formatReleaseDate(props.entry.publishedAt);
});

const changelogHref = computed(
  () => props.entry?.sections.find((s) => s.link)?.link?.href ?? CHANGELOG_URL,
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogPortal v-if="entry">
      <DialogOverlay
        class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogContent
        class="fixed inset-y-4 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border/70 bg-card p-0 shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div class="sticky top-0 z-10 shrink-0 border-b border-border/60 bg-card px-3 py-2">
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <p class="text-xs text-muted-foreground">
              {{ publishedLabel }}
            </p>
            <Button
              as="a"
              :href="changelogHref"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="xs"
              class="gap-1"
            >
              Changelog
              <ArrowUpRightIcon class="size-3" />
            </Button>
            <div class="flex justify-end">
              <DialogClose as-child>
                <Button variant="ghost" size="icon-xs" aria-label="Close">
                  <XIcon class="size-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
          <DialogTitle class="text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground">
            {{ entry.title }}
          </DialogTitle>

          <div class="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
            <img
              v-if="entry.image"
              :src="entry.image"
              :alt="entry.title"
              class="aspect-[16/10] w-full object-cover"
            >
            <div
              v-else
              class="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-muted via-background to-accent/30"
            >
              <div
                class="absolute inset-0 opacity-60"
                style="background-image: radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 55%), radial-gradient(circle at 80% 70%, color-mix(in oklch, var(--ring) 14%, transparent), transparent 50%);"
              />
              <component
                :is="HeroIcon"
                class="relative size-16 text-foreground/25"
                :stroke-width="1.25"
              />
            </div>
          </div>

          <p class="mt-6 text-[15px] leading-relaxed text-foreground/90">
            {{ entry.summary }}
          </p>

          <section
            v-for="(section, sectionIndex) in entry.sections"
            :key="sectionIndex"
            :class="cn(sectionIndex === 0 ? 'mt-5' : 'mt-8')"
          >
            <h3
              v-if="section.heading"
              class="text-base font-semibold text-foreground"
            >
              {{ section.heading }}
            </h3>

            <div
              :class="cn(
                'space-y-3 text-[15px] leading-relaxed text-muted-foreground',
                section.heading && 'mt-3',
              )"
            >
              <p
                v-for="(paragraph, paragraphIndex) in section.paragraphs"
                :key="paragraphIndex"
              >
                {{ paragraph }}
              </p>

              <p v-if="section.shortcut" class="text-muted-foreground">
                {{ section.shortcut.before }}
                <Kbd
                  v-for="(key, keyIndex) in section.shortcut.keys"
                  :key="keyIndex"
                  class="mx-0.5 align-middle"
                >
                  {{ key }}
                </Kbd>
                {{ section.shortcut.after }}
              </p>

              <p v-if="section.link">
                <a
                  :href="section.link.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary underline-offset-4 hover:underline"
                >
                  {{ section.link.label }}
                </a>
              </p>
            </div>
          </section>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
