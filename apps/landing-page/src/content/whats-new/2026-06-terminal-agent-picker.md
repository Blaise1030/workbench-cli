---
title: Terminal agent picker
summary: Choose which agent starts when you open a new terminal — Cursor, Claude, and more.
publishedAt: "2026-06-01"
version: "0.2"
heroIcon: bot
sections:
  - shortcut:
      before: "Use "
      keys: ["⌘", "K"]
      after: " and search \"New terminal\" to open the picker quickly."
  - heading: Per-worktree defaults
    link:
      label: View release notes
      href: https://github.com/Blaise1030/workbench-cli/releases
---

Opening a terminal no longer always uses your default agent. Pick the right tool for the task from a compact chooser when you start a session.

Your selection is remembered per worktree, so the next terminal in the same branch opens with the agent you expect.

## Per-worktree defaults

Each worktree keeps its own last-used agent. Switch branches without resetting your workflow — agents stay scoped to where you left them.
