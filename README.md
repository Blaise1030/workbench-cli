# workbench-cli

A self-contained developer workbench — single Go binary, frontend embedded.

Workbench lets you run coding agents (Claude Code, Codex, Aider, OpenCode, etc.) side by side in the browser, next to the tools you already use for a task — terminals, git worktrees, a file editor, and git diffs, all in one tab. It's a ~20MB Go binary with no Electron and no runtime dependencies; it serves the UI from `localhost` only, so your code never leaves your machine.

Key features:

- **Parallel git worktrees** with one-click switching, so multiple agents/branches can run at once
- **Real terminal per worktree** to run any CLI-based coding agent
- **Built-in file editor** with syntax highlighting
- **Line-level git diffs** (staged/unstaged) without switching apps
- **Command palette** for fuzzy-searching commands, files, and worktrees
- **Agent notifications** when an agent completes or stops

The frontend is a Vue app (`apps/frontend`) served by a Go server (`apps/server-go`); `apps/cli` and `apps/landing-page` handle the CLI installer and marketing site respectively.
