import { ref } from "vue";
import { useEventListener } from "@vueuse/core";

const isOpen = ref(false);

export function openCommandPalette() {
  isOpen.value = true;
}

export function closeCommandPalette() {
  isOpen.value = false;
}

function isCommandPaletteChord(e: KeyboardEvent): boolean {
  if (e.key.toLowerCase() !== "k") return false;
  return e.metaKey || e.ctrlKey;
}

export function useCommandPalette() {
  useEventListener(
    window,
    "keydown",
    (e: KeyboardEvent) => {
      if (!isCommandPaletteChord(e)) return;
      e.preventDefault();
      isOpen.value = !isOpen.value;
    },
    { capture: true },
  );

  return { isOpen };
}
