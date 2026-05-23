<script setup lang="ts">
import { ref } from "vue";
import Login from "./components/Login.vue";
import Terminal from "./components/Terminal.vue";

const authenticated = ref(false);
</script>

<template>
  <Login v-if="!authenticated" @authenticated="authenticated = true" />
  <Terminal v-else style="width: 100%; height: 100vh;" />
</template>
