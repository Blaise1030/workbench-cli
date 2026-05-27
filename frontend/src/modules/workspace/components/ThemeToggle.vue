<script setup lang="ts">
import { MoonIcon, SunIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";

const { colorMode, toggleTheme } = useAppColorMode();
</script>

<template>
  <Button
    variant="ghost"
    size="icon-xs"
    :aria-label="colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  >
    <SunIcon v-if="colorMode === 'dark'" />
    <MoonIcon v-else />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
