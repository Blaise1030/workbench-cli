import type { KeybindingAction, KeybindingsMap } from "./types";

/** macOS US keyboard: Option+1…9 emit these characters (matches ⌥¡ ⌥™ … in Settings). */
export const MAC_OPTION_TAB_CHARS = ["¡", "™", "£", "¢", "∞", "§", "¶", "•", "ª"] as const;

function optionTabChords(): Pick<
  KeybindingsMap,
  | "terminal.tab.1"
  | "terminal.tab.2"
  | "terminal.tab.3"
  | "terminal.tab.4"
  | "terminal.tab.5"
  | "terminal.tab.6"
  | "terminal.tab.7"
  | "terminal.tab.8"
  | "terminal.tab.9"
> {
  const entries = MAC_OPTION_TAB_CHARS.map((char, i) => [
    `terminal.tab.${i + 1}`,
    `Option+${char}`,
  ] as const);
  return Object.fromEntries(entries) as Pick<
    KeybindingsMap,
    `terminal.tab.${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  >;
}

/** Built-in shortcuts; merged under user overrides in ~/.workbench/keybindings.json */
export const KEYBINDING_OPTIONS: KeybindingsMap = {
  "terminal.newTerminal": "Ctrl+Shift+n",
  "panel.explorer": "Meta+Shift+e",
  "panel.git": "Meta+Shift+g",
  ...optionTabChords(),
};
