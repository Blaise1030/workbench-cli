import type { KeybindingAction, KeybindingsMap } from "@server/schemas/api";

export type { KeybindingAction, KeybindingsMap };

export interface KeybindingDescriptor {
  action: KeybindingAction;
  label: string;
  description: string;
}

export const KEYBINDING_DESCRIPTORS: KeybindingDescriptor[] = [
  { action: "terminal.newTerminal", label: "New Terminal", description: "Open a new terminal tab" },
  { action: "panel.explorer", label: "File Explorer", description: "Open the file explorer panel" },
  { action: "panel.git", label: "Git", description: "Open the git panel" },
  { action: "terminal.tab.1", label: "Switch to Tab 1", description: "Navigate to terminal tab 1" },
  { action: "terminal.tab.2", label: "Switch to Tab 2", description: "Navigate to terminal tab 2" },
  { action: "terminal.tab.3", label: "Switch to Tab 3", description: "Navigate to terminal tab 3" },
  { action: "terminal.tab.4", label: "Switch to Tab 4", description: "Navigate to terminal tab 4" },
  { action: "terminal.tab.5", label: "Switch to Tab 5", description: "Navigate to terminal tab 5" },
  { action: "terminal.tab.6", label: "Switch to Tab 6", description: "Navigate to terminal tab 6" },
  { action: "terminal.tab.7", label: "Switch to Tab 7", description: "Navigate to terminal tab 7" },
  { action: "terminal.tab.8", label: "Switch to Tab 8", description: "Navigate to terminal tab 8" },
  { action: "terminal.tab.9", label: "Switch to Tab 9", description: "Navigate to terminal tab 9" },
];
