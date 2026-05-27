<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";

const props = defineProps<{
  lanUrl: string;
  inviteExpiresAt?: number;
}>();

const emit = defineEmits<{ refresh: [] }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);

async function renderQr() {
  if (!canvasRef.value || !props.lanUrl) return;
  await QRCode.toCanvas(canvasRef.value, props.lanUrl, { width: 200, margin: 2 });
}

onMounted(renderQr);
watch(() => props.lanUrl, renderQr);

async function copyUrl() {
  await navigator.clipboard.writeText(props.lanUrl);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>

<template>
  <SettingsSection
    title="Connect from another device"
    description="Link expires in 15 minutes · one-time use"
  >
    <div class="flex flex-col items-start gap-4 py-4">
      <canvas ref="canvasRef" class="rounded-md border border-border" />
      <div class="flex w-full max-w-md gap-2">
        <code class="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">
          {{ lanUrl }}
        </code>
        <Button type="button" variant="outline" size="sm" @click="copyUrl">
          {{ copied ? "Copied" : "Copy" }}
        </Button>
      </div>
      <Button type="button" variant="secondary" size="sm" @click="emit('refresh')">
        Regenerate link
      </Button>
    </div>
  </SettingsSection>
</template>
