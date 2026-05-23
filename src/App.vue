<script setup lang="ts">
import Terminal from "./components/Terminal.vue";

const token = new URLSearchParams(window.location.search).get("token") ?? "";
</script>

<template>
  <Terminal :token="token" style="width: 100%; height: 100vh;" />
</template>
