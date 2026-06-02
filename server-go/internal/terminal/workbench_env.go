// Package terminal: PTY env for agent notify targeting.
//
// Modeled on cmux notifications — https://cmux.com/docs/notifications
// (cmux infers workspace/surface in-app; we stamp WORKBENCH_* at PTY spawn).
// See docs/notifications.md.
package terminal

import "strconv"

// Env vars injected into Workbench PTY sessions (inherited by agent CLIs and hook shells).
const (
	EnvWorkbench        = "WORKBENCH"
	EnvWorkbenchPort    = "WORKBENCH_PORT"
	EnvWorkbenchWorktree = "WORKBENCH_WORKTREE_ID"
	EnvWorkbenchTerminal = "WORKBENCH_TERMINAL_ID"
)

// ApplyWorkbenchEnv sets session env used by workbench-cli notify and hooks.
func ApplyWorkbenchEnv(env map[string]string, terminalID, worktreeID string, port int) {
	env[EnvWorkbench] = "1"
	if terminalID != "" {
		env[EnvWorkbenchTerminal] = terminalID
	}
	if worktreeID != "" {
		env[EnvWorkbenchWorktree] = worktreeID
	}
	if port > 0 {
		env[EnvWorkbenchPort] = strconv.Itoa(port)
	}
}
