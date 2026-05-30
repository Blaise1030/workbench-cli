---
title: Concepts
description: Key ideas behind how Workbench organises your workspace.
order: 2
---

## Workspaces

A workspace is the top-level container for your work session. It holds all your tabs, panes, and worktree state. Workbench saves workspace state automatically so you can pick up where you left off.

## Tabs

Tabs live inside a workspace and let you group related panes together. Give a tab a name that reflects what you are working on — a feature, a bug, or a review.

## Panes

A pane is an individual terminal inside a tab. You can split a tab into multiple panes and run a separate process in each one — an agent in one pane, a test runner in another.

## Worktrees

Workbench makes parallel git worktrees first-class. Each worktree gets its own set of panes so you can run an agent on a feature branch while keeping your main branch clean. Switch between worktrees with one click.

## File Editor

The built-in file editor opens files directly from the terminal without leaving the browser. It includes syntax highlighting for common languages.

## Git Diff

The git diff view shows staged and unstaged changes line-by-line. You can review what an agent has changed without switching to another app.

## Agent Status

Workbench tracks the status of agent processes running in your panes — idle, running, or done. You can wait on a specific status using the CLI:

```sh
workbench wait agent-status --status done
```
