import { ref } from "vue";
import { useEventListener } from "@vueuse/core";

const RECENT_MAX = 10;

const isOpen = ref(false);
export const savedInput = ref("");
export const pendingInitialInput = ref("");
export const recentFiles = ref<string[]>([]);

export function addRecentFile(path: string) {
  const list = recentFiles.value.filter((p) => p !== path);
  recentFiles.value = [path, ...list].slice(0, RECENT_MAX);
}

export function openCommandPalette() {
  isOpen.value = true;
}

export function openWithFileSearch() {
  pendingInitialInput.value = "@";
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
