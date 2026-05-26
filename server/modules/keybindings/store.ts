import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { KeybindingsMap } from "../../schemas/api.js";

export const KEYBINDING_OPTIONS_PATH = join(homedir(), ".workbench", "keybindings.json");

/** macOS US: Option+1…9 → ¡ ™ £ ¢ ∞ § ¶ • ª */
const MAC_OPTION_TAB_CHARS = ["¡", "™", "£", "¢", "∞", "§", "¶", "•", "ª"] as const;

export const KEYBINDING_OPTIONS: KeybindingsMap = {
  "terminal.newTerminal": "Ctrl+Shift+n",
  "panel.explorer": "Ctrl+Shift+e",
  "panel.git": "Ctrl+Shift+g",
  "settings.open": "Ctrl+Shift+,",
  "terminal.tab.1": `Option+${MAC_OPTION_TAB_CHARS[0]}`,
  "terminal.tab.2": `Option+${MAC_OPTION_TAB_CHARS[1]}`,
  "terminal.tab.3": `Option+${MAC_OPTION_TAB_CHARS[2]}`,
  "terminal.tab.4": `Option+${MAC_OPTION_TAB_CHARS[3]}`,
  "terminal.tab.5": `Option+${MAC_OPTION_TAB_CHARS[4]}`,
  "terminal.tab.6": `Option+${MAC_OPTION_TAB_CHARS[5]}`,
  "terminal.tab.7": `Option+${MAC_OPTION_TAB_CHARS[6]}`,
  "terminal.tab.8": `Option+${MAC_OPTION_TAB_CHARS[7]}`,
  "terminal.tab.9": `Option+${MAC_OPTION_TAB_CHARS[8]}`,
};

export async function getKeybindings(
  filePath = KEYBINDING_OPTIONS_PATH,
): Promise<KeybindingsMap> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<KeybindingsMap>;
    return { ...KEYBINDING_OPTIONS, ...parsed };
  } catch {
    return { ...KEYBINDING_OPTIONS };
  }
}

export async function putKeybindings(
  map: KeybindingsMap,
  filePath = KEYBINDING_OPTIONS_PATH,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(map, null, 2), "utf8");
}
