import { computed } from "vue";
import { useAppTheme } from "./useAppTheme";

/** Thin wrapper kept for backward-compat — delegates to useAppTheme. */
export function useAppColorMode() {
  const { effectiveTheme, setSetting } = useAppTheme();

  const colorMode = computed(() =>
    (["evening", "night"] as const).includes(
      effectiveTheme.value as "evening" | "night",
    )
      ? "dark"
      : "light",
  );

  function toggleTheme() {
    setSetting(colorMode.value === "dark" ? "morning" : "night");
  }

  return { colorMode, toggleTheme };
}
