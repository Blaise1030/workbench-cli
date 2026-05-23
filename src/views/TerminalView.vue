<script setup lang="ts">
import { RouterLink } from "vue-router";
import { SettingsIcon } from "@lucide/vue";
import Terminal from "@/components/Terminal.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { Button } from "@/components/ui/button";
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex shrink-0 items-center justify-between px-3 py-2">
      <span class="text-sm text-muted-foreground">lan-terminal</span>
      <div class="flex items-center gap-0.5">
        <ThemeToggle />
        <Button variant="ghost" size="icon-xs" as-child>
          <RouterLink to="/settings" aria-label="Settings">
            <SettingsIcon />
            <span class="sr-only">Settings</span>
          </RouterLink>
        </Button>
      </div>
    </header>
    <Terminal class="min-h-0 flex-1 radius-none" />
  </div>
</template>
