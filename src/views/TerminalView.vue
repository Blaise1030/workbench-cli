<script setup lang="ts">
import { RouterLink } from "vue-router";
import { SettingsIcon } from "@lucide/vue";
import TerminalWorkspace from "@/components/TerminalWorkspace.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { Button } from "@/components/ui/button";
</script>

<template>
  <div class="flex h-screen flex-col">
    <TerminalWorkspace class="min-h-0 flex-1">
      <template #toolbar-end>
        <ThemeToggle />
        <Button variant="ghost" size="icon-xs" as-child>
          <RouterLink to="/settings" aria-label="Settings">
            <SettingsIcon />
            <span class="sr-only">Settings</span>
          </RouterLink>
        </Button>
      </template>
    </TerminalWorkspace>
  </div>
</template>
