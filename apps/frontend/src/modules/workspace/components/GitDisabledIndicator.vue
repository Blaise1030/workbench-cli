<script setup lang="ts">
import { GitBranchIcon, XIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

withDefaults(
  defineProps<{
    size?: "xs" | "sm";
  }>(),
  { size: "sm" },
);
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          class="inline-flex shrink-0 cursor-default"
          tabindex="0"
          aria-label="Git is not enabled"
        >
          <Button
            variant="ghost"
            :size="size === 'xs' ? 'icon-xs' : 'icon-sm'"
            class="relative shrink-0 opacity-50 pointer-events-none"
            tabindex="-1"
          >
            <span class="relative inline-flex size-3.5">
              <GitBranchIcon class="size-3.5 shrink-0" />
              <XIcon
                class="absolute -bottom-0.5 -right-0.5 size-2 shrink-0 stroke-[2.5]"
              />
            </span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom"> Git is not enabled </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
