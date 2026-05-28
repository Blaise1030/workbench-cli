package agents

import (
	"database/sql"
	"log/slog"

	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
	"github.com/blaisetiong/workbench-cli/server-go/internal/workspace"
)

// HandleCommandComplete processes an OSC 133 command-complete event.
// It detects agent invocations and stores the latest session ID.
func HandleCommandComplete(
	db *sql.DB,
	store settings.Store,
	terminalID string,
	event terminal.OscCommandReport,
	cwd string,
	onStored func(kind, sessionID string),
) {
	if event.CommandLine == nil || *event.CommandLine == "" {
		return
	}
	adapter := MatchAdapter(*event.CommandLine)
	if adapter == nil {
		return
	}
	if !settings.GetBool(store, "terminal.agentHooks."+adapter.Kind+".enabled", true) {
		return
	}
	sessionID := adapter.FindLatest(cwd, DefaultHome())
	if sessionID == "" {
		return
	}
	if err := workspace.UpdateTerminalAgentSession(db, terminalID, adapter.Kind, sessionID); err != nil {
		slog.Error("update agent session", "terminalId", terminalID, "err", err)
		return
	}
	if onStored != nil {
		onStored(adapter.Kind, sessionID)
	}
}
