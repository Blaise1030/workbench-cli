---
title: Concepts
description: Key ideas behind how Workbench organises your workspace.
order: 2
---

## Projects

A project maps to a git repository on your machine. Projects are listed in the left sidebar and act as the top-level container for all your worktrees. You can add any local repo as a project using the **Add project** button at the bottom of the sidebar, and remove it just as easily. Workbench saves project state automatically so you can pick up where you left off.

![Projects and worktrees listed in the sidebar](/workbench-cli/assets/screenshot-projects.png)

## Worktrees

Workbench makes parallel git worktrees first-class. Each worktree corresponds to a branch and appears under its parent project in the sidebar. Clicking a worktree opens its panes in the main area. You can create a new worktree with the **New worktree** button beneath each project — Workbench creates the git worktree on disk and registers it in one step. If a worktree's directory is later deleted outside Workbench, it shows a **missing** badge in the sidebar.

## Panes

A pane is an individual terminal inside a worktree. Panes appear as tabs along the top of the main area. Each pane runs its own process — typically a shell or an AI agent — and is named after that process (for example, "Cursor Agent" or "zsh"). Open a new pane with the **Add terminal** button in the top-right toolbar, and close any pane with the × on its tab. You can run multiple panes simultaneously: an agent in one, a test runner in another.

![Multiple panes as tabs inside a worktree](/workbench-cli/assets/screenshot-panes.png)

## File Editor

The built-in file editor is accessible via the **File explorer** button in the top-right toolbar. A file tree on the right panel lets you navigate the worktree's directory. Clicking a file opens it in a read-only code viewer with full syntax highlighting. The editor keeps you in the browser — no need to switch to an external app to inspect what an agent has changed.

![File explorer tree and file editor with syntax highlighting](/workbench-cli/assets/screenshot-file-editor.png)

## Git Diff

The git diff view is accessible via the **Git** button in the top-right toolbar. It shows two tabs — **Staged** and **Unstaged** — each with a file count. Diffs are rendered inline with added and removed lines highlighted. A **Commit** button lets you commit staged changes without leaving the browser. Use this view to review exactly what an agent has written before committing.

![Git diff view showing unstaged changes inline](/workbench-cli/assets/screenshot-git-diff-concepts.png)

## Agent Status

Workbench tracks the status of agent processes running in your panes. Each pane tab displays the name of the running process and a live status indicator — a spinner when the process is active, and a dot when it is idle. A background task count in the pane shows how many sub-tasks the agent is running concurrently.

## Context Queue

The context queue is a scratch panel accessible via the **Context queue** button in the top-right toolbar. It holds code snippets and notes you want to pass to an agent. Queue items persist for the lifetime of the worktree session so you can collect relevant context across multiple files before handing it to your agent.

![Context queue panel for collecting snippets and notes](/workbench-cli/assets/screenshot-context-queue.png)
