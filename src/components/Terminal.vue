<script setup lang="ts">
import { ref } from "vue";
import { Terminal as WTerm, type WTerm as WTermInstance } from "@wterm/vue";
import "@wterm/vue/css";
import "@/assets/terminal.css";

const termRef = ref<InstanceType<typeof WTerm> | null>(null);
const wsRef = ref<WebSocket | null>(null);

function onReady(wt: WTermInstance) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  wsRef.value = ws;

  ws.onopen = () => {
    ws.send(`\x1b[RESIZE:${wt.cols};${wt.rows}]`);
  };

  ws.onmessage = (event: MessageEvent<string>) => {
    termRef.value?.write(event.data);
  };

  ws.onclose = () => {
    termRef.value?.write(
      "\r\n\x1b[90m[session ended — reload to reconnect]\x1b[0m\r\n",
    );
    wsRef.value = null;
  };
}

function onData(data: string) {
  if (wsRef.value?.readyState === WebSocket.OPEN) {
    wsRef.value.send(data);
  }
}

function onResize(cols: number, rows: number) {
  if (wsRef.value?.readyState === WebSocket.OPEN) {
    wsRef.value.send(`\x1b[RESIZE:${cols};${rows}]`);
  }
}
</script>

<template>
  <WTerm
    ref="termRef"
    theme="app"
    auto-resize
    cursor-blink
    @ready="onReady"
    @data="onData"
    @resize="onResize"
    style="width: 100%; height: 100%; max-height: 100dvh"
  />
</template>
