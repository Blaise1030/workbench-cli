import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { KeybindingsMap } from "../../schemas/api.js";

export const DEFAULT_KEYBINDING_PATH = join(homedir(), ".workbench", "keybindings.json");

export const DEFAULT_KEYBINDINGS: KeybindingsMap = {
  "terminal.newTerminal": "Meta+n",
  "panel.explorer": "Meta+e",
  "panel.git": "Meta+g",
  "terminal.tab.1": "Meta+1",
  "terminal.tab.2": "Meta+2",
  "terminal.tab.3": "Meta+3",
  "terminal.tab.4": "Meta+4",
  "terminal.tab.5": "Meta+5",
  "terminal.tab.6": "Meta+6",
  "terminal.tab.7": "Meta+7",
  "terminal.tab.8": "Meta+8",
  "terminal.tab.9": "Meta+9",
};

export async function getKeybindings(
  filePath = DEFAULT_KEYBINDING_PATH,
): Promise<KeybindingsMap> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<KeybindingsMap>;
    return { ...DEFAULT_KEYBINDINGS, ...parsed };
  } catch {
    return { ...DEFAULT_KEYBINDINGS };
  }
}

export async function putKeybindings(
  map: KeybindingsMap,
  filePath = DEFAULT_KEYBINDING_PATH,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(map, null, 2), "utf8");
}
