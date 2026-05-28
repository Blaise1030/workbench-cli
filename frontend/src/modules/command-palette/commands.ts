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

export type NavigateCommand = {
  type: "navigate";
  id: string;
  label: string;
  icon: Component;
  to: (worktreeId: string) => RouteLocationRaw;
  requiresWorktree: boolean;
};

export type ActionCommand = {
  type: "action";
  id: string;
  label: string;
  icon: Component;
  action: string;
};

export type Command = NavigateCommand | ActionCommand;

export const COMMANDS: Command[] = [
  {
    type: "navigate",
    id: "nav.terminal",
    label: "Open Terminal",
    icon: TerminalIcon,
    to: (worktreeId) => ({ name: "terminal", params: { worktreeId } }),
    requiresWorktree: true,
  },
  {
    type: "navigate",
    id: "nav.explorer",
    label: "Open File Explorer",
    icon: FolderTreeIcon,
    to: (worktreeId) => ({ name: "explorer", params: { worktreeId } }),
    requiresWorktree: true,
  },
  {
    type: "navigate",
    id: "nav.git",
    label: "Open Git Panel",
    icon: GitBranchIcon,
    to: (worktreeId) => ({ name: "git", params: { worktreeId } }),
    requiresWorktree: true,
  },
  {
    type: "navigate",
    id: "nav.settings",
    label: "Open Settings",
    icon: SettingsIcon,
    to: () => ({ name: "settings" }),
    requiresWorktree: false,
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
