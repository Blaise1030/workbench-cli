import { useColorMode } from "@vueuse/core";
import { watch } from "vue";
import { syncFavicon } from "@/shared/lib/sync-favicon";

const colorModeOptions = {
  attribute: "class",
  modes: {
    light: "",
    dark: "dark",
  },
} as const;

/** App light/dark mode (Tailwind `.dark` on `<html>`). */
export function useAppColorMode() {
  const colorMode = useColorMode(colorModeOptions);

  watch(
    colorMode,
    (mode) => syncFavicon(mode === "dark"),
    { immediate: true },
  );

  function toggleTheme() {
    colorMode.value = colorMode.value === "dark" ? "light" : "dark";
  }

  return { colorMode, toggleTheme };
}
