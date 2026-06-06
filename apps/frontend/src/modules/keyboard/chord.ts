/** Chords commonly reserved by browsers; the page may not receive keydown. */
const BROWSER_RESERVED_CHORDS = new Set<string>([
  ...Array.from({ length: 9 }, (_, i) => [`Meta+${i + 1}`, `Ctrl+${i + 1}`]).flat(),
  "Meta+n",
  "Meta+t",
  "Meta+w",
  "Meta+r",
  "Meta+l",
  "Meta+f",
  "Meta+g",
  "Meta+e",
  "Meta+p",
  "Meta+b",
  "Meta+d",
  "Meta+h",
  "Meta+j",
  "Meta+k",
  "Ctrl+n",
  "Ctrl+t",
  "Ctrl+w",
  "Ctrl+r",
  "Ctrl+l",
  "Ctrl+f",
  "Ctrl+g",
  "Ctrl+e",
  "Ctrl+p",
  "Ctrl+b",
  "Ctrl+d",
  "Ctrl+h",
  "Ctrl+j",
  "Ctrl+k",
]);

export function isBrowserReservedChord(chord: string): boolean {
  return BROWSER_RESERVED_CHORDS.has(normalizeStoredChord(chord));
}

import { MAC_OPTION_TAB_CHARS } from "./options";

/** Legacy Option+digit chords → macOS US Option character chords. */
const LEGACY_OPTION_TAB_CHORDS = Object.fromEntries(
  MAC_OPTION_TAB_CHARS.map((char, i) => [`Option+${i + 1}`, `Option+${char}`]),
) as Record<string, string>;

/** Legacy saves used Alt; stored chords use Option (macOS ⌥). */
export function normalizeStoredChord(chord: string): string {
  const withOption = chord.replace(/\bAlt\b/g, "Option");
  return LEGACY_OPTION_TAB_CHORDS[withOption] ?? withOption;
}

function chordKeyToken(key: string): string {
  if (key.length === 1 && key >= "a" && key <= "z") return key;
  if (key.length === 1 && key >= "A" && key <= "Z") return key.toLowerCase();
  return key;
}

export function eventToChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Option");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key;
  if (!["Meta", "Control", "Alt", "Shift"].includes(key)) {
    parts.push(chordKeyToken(key));
  }
  return parts.join("+");
}

export function chordLabel(chord: string): string {
  return normalizeStoredChord(chord)
    .replace("Meta", "⌘")
    .replace("Ctrl", "⌃")
    .replace("Option", "⌥")
    .replace("Shift", "⇧")
    .replace(/\+/g, "");
}
