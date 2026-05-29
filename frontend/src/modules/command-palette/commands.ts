import type { RouteLocationRaw } from "vue-router";
import {
  TerminalIcon,
  FolderTreeIcon,
  GitBranchIcon,
  SettingsIcon,
  FolderPlusIcon,
  SunMoonIcon,
} from "@lucide/vue";
import type { Component } from "vue";
import type { KeybindingAction } from "@/modules/keyboard/types";

export type NavigateCommand = {
  type: "navigate";
  id: string;
  label: string;
  icon: Component;
  to: (worktreeId: string) => RouteLocationRaw;
  requiresWorktree: boolean;
  keybindingAction?: KeybindingAction;
};

export type ActionCommand = {
  type: "action";
  id: string;
  label: string;
  icon: Component;
  action: string;
  keybindingAction?: KeybindingAction;
};

export type Command = NavigateCommand | ActionCommand;

export const COMMANDS: Command[] = [
  {
    type: "action",
    id: "action.newTerminal",
    label: "New Terminal",
    icon: TerminalIcon,
    action: "newTerminal",
    keybindingAction: "terminal.newTerminal",
  },
  {
    type: "navigate",
    id: "nav.explorer",
    label: "Open File Explorer",
    icon: FolderTreeIcon,
    to: (worktreeId) => ({ name: "explorer", params: { worktreeId } }),
    requiresWorktree: true,
    keybindingAction: "panel.explorer",
  },
  {
    type: "navigate",
    id: "nav.git",
    label: "Open Git Panel",
    icon: GitBranchIcon,
    to: (worktreeId) => ({ name: "git", params: { worktreeId } }),
    requiresWorktree: true,
    keybindingAction: "panel.git",
  },
  {
    type: "navigate",
    id: "nav.settings",
    label: "Open Settings",
    icon: SettingsIcon,
    to: () => ({ name: "settings" }),
    requiresWorktree: false,
    keybindingAction: "settings.open",
  },
  {
    type: "action",
    id: "action.addProject",
    label: "Add Project",
    icon: FolderPlusIcon,
    action: "addProject",
  },
  {
    type: "action",
    id: "action.toggleTheme",
    label: "Toggle Theme",
    icon: SunMoonIcon,
    action: "toggleTheme",
  },
];
