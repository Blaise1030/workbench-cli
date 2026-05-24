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
      <div class="p-6 max-w-lg">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
