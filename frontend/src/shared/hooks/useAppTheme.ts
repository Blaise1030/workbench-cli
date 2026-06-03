import { computed, watch } from "vue";
import { createSharedComposable, useLocalStorage } from "@vueuse/core";
import { syncFavicon } from "@/shared/lib/sync-favicon";

export type ThemeMode = "morning" | "afternoon" | "evening" | "night";
export type ThemeSetting = ThemeMode | "auto";

const DARK_THEMES: readonly ThemeMode[] = ["evening", "night"];

function getTimeBasedTheme(): ThemeMode {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function applyTheme(theme: ThemeMode) {
  const html = document.documentElement;
  html.classList.remove(
    "theme-morning",
    "theme-afternoon",
    "theme-evening",
    "theme-night",
  );
  html.classList.add(`theme-${theme}`);
  if (DARK_THEMES.includes(theme)) {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
  syncFavicon(DARK_THEMES.includes(theme));
}

function _useAppTheme() {
  const setting = useLocalStorage<ThemeSetting>(
    "workbench:theme-setting",
    "auto",
  );

  const effectiveTheme = computed<ThemeMode>(() =>
    setting.value === "auto" ? getTimeBasedTheme() : setting.value,
  );

  watch(effectiveTheme, applyTheme, { immediate: true });

  let autoTimer: ReturnType<typeof setInterval> | null = null;
  watch(
    setting,
    (s) => {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
      if (s === "auto") {
        autoTimer = setInterval(() => applyTheme(getTimeBasedTheme()), 60_000);
      }
    },
    { immediate: true },
  );

  function setSetting(s: ThemeSetting) {
    setting.value = s;
  }

  return { setting, effectiveTheme, setSetting };
}

export const useAppTheme = createSharedComposable(_useAppTheme);
