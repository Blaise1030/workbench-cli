# Settings Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal tab bar in SettingsView with a left sidebar using the existing shadcn-vue Sidebar component system.

**Architecture:** Single-file rewrite of `SettingsView.vue` — wrap the layout in `SidebarProvider`, render nav items in a `Sidebar` on the left, and render `<RouterView />` inside `SidebarInset` on the right. No router, no child pages, no new files.

**Tech Stack:** Vue 3, Vue Router 4, shadcn-vue Sidebar components (`@/components/ui/sidebar`), Tailwind CSS v4

---

### Task 1: Rewrite SettingsView.vue with sidebar layout

**Files:**
- Modify: `src/modules/settings/layout/SettingsView.vue`

- [ ] **Step 1: Open the file**

Current contents for reference:

```vue
<script setup lang="ts">
import { useRouter, useRoute, RouterView } from "vue-router";

const router = useRouter();
const route = useRoute();
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="flex items-center gap-3 border-b px-4 py-3">
      <button class="text-sm hover:underline" @click="router.back()">← Back</button>
      <h1 class="text-lg font-semibold">Settings</h1>
    </header>
    <main class="mx-auto max-w-lg p-4">
      <div class="flex gap-1 border-b mb-4">
        <button
          class="px-3 py-1.5 text-sm transition-colors"
          :class="route.name === 'settings-general'
            ? 'border-b-2 border-foreground font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'"
          @click="router.push({ name: 'settings-general' })"
        >
          General
        </button>
        <button
          class="px-3 py-1.5 text-sm transition-colors"
          :class="route.name === 'settings-network'
            ? 'border-b-2 border-foreground font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'"
          @click="router.push({ name: 'settings-network' })"
        >
          Network
        </button>
      </div>
      <RouterView />
    </main>
  </div>
</template>
```

- [ ] **Step 2: Replace with sidebar layout**

Replace the entire file with:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute, RouterView } from "vue-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

const router = useRouter();
const route = useRoute();

const navItems = [
  { label: "General", name: "settings-general" },
  { label: "Network", name: "settings-network" },
];

const activeLabel = computed(
  () => navItems.find((item) => item.name === route.name)?.label ?? "Settings",
);
</script>

<template>
  <SidebarProvider class="min-h-screen">
    <Sidebar collapsible="none">
      <SidebarHeader class="px-4 py-3">
        <span class="text-base font-semibold">Settings</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="item in navItems" :key="item.name">
                <SidebarMenuButton
                  :is-active="route.name === item.name"
                  @click="router.push({ name: item.name })"
                >
                  {{ item.label }}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter class="px-2 py-3">
        <button
          class="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
          @click="router.back()"
        >
          ← Back
        </button>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset>
      <header class="flex h-10 items-center border-b px-4">
        <span class="text-sm font-medium">{{ activeLabel }}</span>
      </header>
      <main class="p-6 max-w-lg">
        <RouterView />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
```

- [ ] **Step 3: Verify in browser**

Run the dev server:
```bash
npm run dev
```

Navigate to `/settings`. Confirm:
- Left sidebar shows "Settings" header with General and Network nav items
- Clicking General navigates to `/settings/general` and highlights the item
- Clicking Network navigates to `/settings/network` and highlights the item
- Content area shows the correct page title and renders the child route
- "← Back" button navigates back

- [ ] **Step 4: Commit**

```bash
git add src/modules/settings/layout/SettingsView.vue
git commit -m "feat(settings): replace tab bar with sidebar layout"
```
