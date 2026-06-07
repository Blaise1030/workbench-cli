<script setup lang="ts">
import { computed } from "vue";
import { MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import { useAppTheme, type ThemeMode, type ThemeSetting } from "@/shared/hooks/useAppTheme";

const { setting, effectiveTheme, setSetting } = useAppTheme();

const themes = [
  { value: "morning" as ThemeMode, icon: SunriseIcon, label: "Morning", time: "5am–12pm" },
  { value: "afternoon" as ThemeMode, icon: SunIcon, label: "Noon", time: "12–5pm" },
  { value: "evening" as ThemeMode, icon: SunsetIcon, label: "Evening", time: "5–9pm" },
  { value: "night" as ThemeMode, icon: MoonIcon, label: "Night", time: "9pm–5am" },
] as const;

const isAuto = computed({
  get: () => setting.value === "auto",
  set: (v: boolean) => setSetting(v ? "auto" : (effectiveTheme.value as ThemeSetting)),
});
</script>

<template>
  <SettingsPage title="Appearance" description="Customize how the app looks.">
    <SettingsSection title="Theme" description="Choose a theme or let the app pick one based on the time of day.">
      <Card class="flex flex-col gap-2 p-4">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Theme</ItemTitle>
            <ItemDescription>Select the visual style of the interface.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <div class="grid grid-cols-4 gap-1">
              <Button
                v-for="t in themes"
                :key="t.value"
                :variant="effectiveTheme === t.value && !isAuto ? 'secondary' : 'outline'"
                class="flex h-auto flex-col gap-1 px-3 py-2"
                :aria-label="t.label"
                @click="setSetting(t.value)"
              >
                <component :is="t.icon" class="size-4" />
                <span class="text-xs">{{ t.label }}</span>
                <span class="text-[10px] leading-none text-muted-foreground">{{ t.time }}</span>
              </Button>
            </div>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Auto-detect time</ItemTitle>
            <ItemDescription>Automatically switch theme based on the time of day.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch id="theme-auto" v-model:checked="isAuto" />
          </ItemActions>
        </Item>
      </Card>
    </SettingsSection>
  </SettingsPage>
</template>
