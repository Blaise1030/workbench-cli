<script setup lang="ts">
import { ref } from "vue";
import { ExternalLinkIcon } from "@lucide/vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INSTALL_CMD, RELEASES_URL } from "@/modules/settings/lib/release";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  currentVersion: string;
  latestVersion: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  dismiss: [];
}>();

const copying = ref(false);

function close() {
  emit("update:open", false);
}

function dismiss() {
  emit("dismiss");
  close();
}

async function copyInstallCmd() {
  copying.value = true;
  try {
    await navigator.clipboard.writeText(INSTALL_CMD);
    toast.success("Install command copied to clipboard");
  } catch {
    toast.error("Could not copy to clipboard");
  } finally {
    copying.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Update available</DialogTitle>
        <DialogDescription>
          A new version of workbench-cli is available. Run the install command in your terminal to
          update.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <div class="text-sm">
          <span class="text-muted-foreground">Current:</span>
          <span class="ml-1 font-mono">v{{ currentVersion }}</span>
          <span class="mx-2 text-muted-foreground">→</span>
          <span class="text-muted-foreground">Latest:</span>
          <span class="ml-1 font-mono">v{{ latestVersion }}</span>
        </div>

        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">Install command</p>
          <pre
            class="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed"
          >{{ INSTALL_CMD }}</pre>
        </div>

        <a
          :href="RELEASES_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Release notes
          <ExternalLinkIcon class="size-3.5" />
        </a>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button type="button" variant="ghost" @click="dismiss">Dismiss</Button>
        <div class="flex gap-2">
          <Button type="button" variant="outline" @click="close">Close</Button>
          <Button type="button" :disabled="copying" @click="copyInstallCmd">
            Copy command
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
