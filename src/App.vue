<script setup lang="ts">
import Terminal from "./components/Terminal.vue";

const urlToken = new URLSearchParams(window.location.search).get("token");
if (urlToken) localStorage.setItem("terminal-token", urlToken);
const token = urlToken ?? localStorage.getItem("terminal-token") ?? "";
</script>

<template>
  <Terminal :token="token" style="width: 100%; height: 100vh;" />
</template>
