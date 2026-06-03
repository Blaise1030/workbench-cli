# Agent hooks — register and notify

Workbench integrates with coding agents (Claude Code, Cursor, Codex, Gemini CLI) through two complementary CLI hooks:

| Hook | CLI command | Agent event | Purpose |
|------|-------------|-------------|---------|
| **Register** | `workbench-cli register` | `PreToolUse` | Binds the agent session to a Workbench terminal tab |
| **Notify** | `workbench-cli notify` | `Stop`, `SubagentStop`, `Notification` | Sends a notification when the session reaches a lifecycle event |

Both hooks are configured in **Settings → Agents** and written to the agent's config file (e.g., `~/.claude/settings.json`) via the **Apply** button or **Copy JSON**.

## Register hook

```bash
workbench-cli register --source claude --state running
```

Called on `PreToolUse` so it fires early in the session. The hook reads the `session_id` from stdin (Claude Code hook payload JSON) and the terminal/worktree context from `WORKBENCH_*` env vars injected at PTY spawn.

`register` POST body sent to `POST /api/register`:

```json
{
  "terminalId": "<WORKBENCH_TERMINAL_ID>",
  "worktreeId": "<WORKBENCH_WORKTREE_ID>",
  "source":     "claude",
  "sessionId":  "<from stdin>",
  "state":      "running"
}
```

If `WORKBENCH_TERMINAL_ID` is not set (i.e. the agent was not launched from a Workbench terminal tab) the command exits silently — it is safe to have in the config unconditionally.

**`--source`** maps to the agent ID (`claude`, `cursor`, `codex`, `gemini`) and is used to match the PTY registry entry. Built-in agents have this value hardcoded in the generated manifest; custom agents use the first token of their start command.

## Notify hook

```bash
workbench-cli notify \
  --worktree-id "$WORKBENCH_WORKTREE_ID" \
  --terminal-id "$WORKBENCH_TERMINAL_ID" \
  --title "Claude Code" \
  --body  "Session finished"
```

Configured per lifecycle event (toggleable in the UI). The title and body are editable in Settings → Agents. The command POSTs to `POST /api/notifications/hook` on the loopback server.

See [notifications.md](./notifications.md) for the full notification flow (panel, desktop alerts, read semantics).

## Generated Claude settings.json

When hooks are enabled the manifest produced by `buildAgentManifest` (`server-go/internal/settings/agents_config.go`) looks like:

```json
{
  "hooks": {
    "PreToolUse": [
      { "type": "command", "command": "workbench-cli register --source claude --state running" }
    ],
    "Stop": [
      { "type": "command", "command": "workbench-cli notify --worktree-id \"$WORKBENCH_WORKTREE_ID\" --terminal-id \"$WORKBENCH_TERMINAL_ID\" --title \"Claude Code\" --body \"Session finished\"" }
    ]
  }
}
```

Additional events (`SubagentStop`, `Notification`) appear under their own keys when toggled on.

## PTY environment variables

Both hooks rely on env vars stamped by Workbench at PTY spawn (`server-go/internal/terminal/workbench_env.go`):

| Variable | Value |
|----------|-------|
| `WORKBENCH_TERMINAL_ID` | Terminal tab UUID |
| `WORKBENCH_WORKTREE_ID` | Worktree UUID |
| `WORKBENCH_PORT` | Local server port |
| `WORKBENCH_TERMINAL_NAME` | Human-readable tab name (used as notification subtitle) |

**Requirement:** the agent must be launched from a Workbench terminal tab so these vars are present.

## Status updates (advanced)

`workbench-cli status --state <state>` posts to `POST /api/agent-status` to update the live state badge on the sidebar without sending a notification. Useful for granular state reporting (`thinking`, `waiting`, `done`) via `PostToolUse` or wrapper scripts.

## Code map

| Area | Path |
|------|------|
| Register CLI | `server-go/internal/cli/register.go` |
| Notify CLI | `server-go/internal/cli/notify.go` |
| Status CLI | `server-go/internal/cli/status.go` |
| Hook command generation | `server-go/internal/settings/agents_config.go` (`BuildRegisterCommand`, `BuildNotifyCommand`, `buildAgentManifest`) |
| Agent config store | `server-go/internal/settings/agents_config.go` (`AgentsStore`) |
| PTY env injection | `server-go/internal/terminal/workbench_env.go` |
| Agents settings UI | `frontend/src/modules/settings/pages/AgentsSettings.vue` |

## Related

- [Notifications](./notifications.md) — notification panel, desktop alerts, OSC 133 source
- [Terminal architecture](./terminal-architecture.md) — PTY spawn, env injection
