<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  <Card>
    <CardHeader>
      <CardTitle>Connect from another device</CardTitle>
      <CardDescription>Link expires in 15 minutes · one-time use</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col items-center gap-4">
      <canvas ref="canvasRef" class="rounded-md border" />
      <div class="flex w-full gap-2">
        <code class="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{{ lanUrl }}</code>
        <Button type="button" variant="outline" size="sm" @click="copyUrl">
          {{ copied ? "Copied" : "Copy" }}
        </Button>
      </div>
      <Button type="button" variant="secondary" class="w-full" @click="emit('refresh')">
        Regenerate link
      </Button>
    </CardContent>
  </Card>
</template>
