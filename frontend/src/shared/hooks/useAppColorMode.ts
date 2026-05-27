import { useColorMode } from "@vueuse/core";

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

  function toggleTheme() {
    colorMode.value = colorMode.value === "dark" ? "light" : "dark";
  }

  return { colorMode, toggleTheme };
}
