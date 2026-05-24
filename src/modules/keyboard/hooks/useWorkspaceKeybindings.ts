import { useEventListener } from "@vueuse/core";
import type { ComputedRef } from "vue";
import { useKeybindingsQuery } from "../queries/keybindings";
import { DEFAULT_KEYBINDINGS } from "../defaults";
import type { KeybindingAction, KeybindingsMap } from "../types";

interface WorkspaceKeybindingOptions {
  terminalTabItems: ComputedRef<{ id: string }[]>;
  navigateToTerminal: (id: string) => void;
  addTerminal: () => Promise<void>;
  openAuxPanel: (type: "git" | "explorer") => void;
}

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function eventToChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key;
  if (!["Meta", "Control", "Alt", "Shift"].includes(key)) {
    parts.push(key.length === 1 ? key.toLowerCase() : key);
  }
  return parts.join("+");
}

function isInputTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  if (INPUT_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useWorkspaceKeybindings(options: WorkspaceKeybindingOptions) {
  const { terminalTabItems, navigateToTerminal, addTerminal, openAuxPanel } = options;
  const { data: bindings } = useKeybindingsQuery();

  useEventListener(window, "keydown", (e: KeyboardEvent) => {
    if (isInputTarget(e)) return;

    const chord = eventToChord(e);
    if (!chord) return;

    const map: KeybindingsMap = bindings.value ?? DEFAULT_KEYBINDINGS;
    const matched = (Object.keys(map) as KeybindingAction[]).find(
      (action) => map[action] === chord,
    );
    if (!matched) return;

    e.preventDefault();

    if (matched === "terminal.newTerminal") {
      void addTerminal();
      return;
    }
    if (matched === "panel.explorer") {
      openAuxPanel("explorer");
      return;
    }
    if (matched === "panel.git") {
      openAuxPanel("git");
      return;
    }
    const tabMatch = matched.match(/^terminal\.tab\.(\d)$/);
    if (tabMatch) {
      const index = parseInt(tabMatch[1], 10) - 1;
      const tab = terminalTabItems.value[index];
      if (tab) navigateToTerminal(tab.id);
    }
  });
}
