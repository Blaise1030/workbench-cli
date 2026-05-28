import { ref } from "vue";
import { useEventListener } from "@vueuse/core";

const isOpen = ref(false);

export function openCommandPalette() {
  isOpen.value = true;
}

export function closeCommandPalette() {
  isOpen.value = false;
}

export function useCommandPalette() {
  useEventListener(window, "keydown", (e: KeyboardEvent) => {
    if (e.metaKey && e.key === "k") {
      e.preventDefault();
      isOpen.value = !isOpen.value;
    }
  }, { capture: true });

  return { isOpen };
}
