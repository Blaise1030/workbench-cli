<script setup lang="ts">
import type { Component } from "vue";
import { useRouter, useRoute, RouterView, RouterLink } from "vue-router";
import {
  ChevronLeftIcon,
  GlobeIcon,
  KeyboardIcon,
  Settings2Icon,
} from "@lucide/vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

const router = useRouter();
const route = useRoute();

const navItems: { label: string; name: string; icon: Component }[] = [
  { label: "General", name: "settings-general", icon: Settings2Icon },
  { label: "Network", name: "settings-network", icon: GlobeIcon },
  { label: "Keybindings", name: "settings-keybindings", icon: KeyboardIcon },
];
</script>

<template>
  <SidebarProvider class="h-svh overflow-hidden">
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu class="gap-1.5">
              <SidebarMenuItem v-for="item in navItems" :key="item.name">
                <SidebarMenuButton
                  as-child
                  :is-active="route.name === item.name"
                >
                  <RouterLink :to="{ name: item.name }">
                    <component :is="item.icon"></component>
                    <span>{{ item.label }}</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu class="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton @click="router.back()">
              <ChevronLeftIcon />
              <span>Back</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset class="min-h-0 flex-1 flex-col overflow-hidden">
      <div class="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto p-6">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
