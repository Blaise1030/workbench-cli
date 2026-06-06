<script setup lang="ts">
import { computed } from "vue";
import { MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppTheme, type ThemeMode, type ThemeSetting } from "@/shared/hooks/useAppTheme";

const { setting, effectiveTheme, setSetting } = useAppTheme();

const themes = [
  { value: "morning" as ThemeMode, icon: SunriseIcon, label: "Morning", time: "5am–12pm" },
  { value: "afternoon" as ThemeMode, icon: SunIcon, label: "Noon", time: "12–5pm" },
  { value: "evening" as ThemeMode, icon: SunsetIcon, label: "Evening", time: "5–9pm" },
  { value: "night" as ThemeMode, icon: MoonIcon, label: "Night", time: "9pm–5am" },
] as const;

const currentTheme = computed(() =>
  themes.find((t) => t.value === effectiveTheme.value) ?? themes[0],
);

const isAuto = computed({
  get: () => setting.value === "auto",
  set: (v: boolean) =>
    setSetting(v ? "auto" : (effectiveTheme.value as ThemeSetting)),
});


</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        :aria-label="`Theme: ${currentTheme.label}`"
      >
        <component :is="currentTheme.icon" />
      </Button>
    </PopoverTrigger>

    <!-- @focus-outside.prevent keeps the popover from closing when
         the View Transition briefly steals focus during theme switch -->
    <PopoverContent
      class="w-56 p-0"
      align="center"
      :side-offset="6"
      @focus-outside.prevent
    >
      <div class="space-y-1 p-1">
        <!-- Icon labels aligned to slider stops -->
        <div class="grid grid-cols-4 gap-0.5">
          <Button
            v-for="t in themes"
            :key="t.value"
            :variant="effectiveTheme === t.value ? 'secondary' : 'ghost'"
            class="aspect-square h-auto flex-col gap-0.5 py-1.5"
            :aria-label="t.label"
            @click="setSetting(t.value)"
          >
            <component :is="t.icon" class="size-3.5" />
            <span class="text-[9px] leading-none">{{ t.label }}</span>
          </Button>
        </div>

        <!-- Auto-detect toggle -->
        <div class="flex items-center justify-between p-1">
          <Label
            for="theme-auto"
            class="cursor-pointer text-xs text-muted-foreground"
          >
            Auto-detect time
          </Label>
          <Switch id="theme-auto" size="sm" v-model:checked="isAuto" />
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

