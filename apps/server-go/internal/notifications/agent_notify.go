package notifications

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/blaisetiong/workbench-cli/server-go/internal/agents"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
)

var agentLabels = map[string]string{
	"claude": "Claude Code",
	"codex":  "Codex",
	"cursor": "Cursor Agent",
	"gemini": "Gemini CLI",
}

// MaybeNotifyAgentComplete creates an in-app notification when a supported agent CLI exits successfully.
func MaybeNotifyAgentComplete(
	db *sql.DB,
	store settings.Store,
	worktreeID, terminalID string,
	report terminal.OscCommandReport,
) {
	if report.CommandExit == nil || *report.CommandExit != 0 {
		return
	}
	if report.CommandLine == nil || *report.CommandLine == "" {
		return
	}
	adapter := agents.MatchAdapter(*report.CommandLine)
	if adapter == nil {
		return
	}
	agentsFile := settings.NewAgentsStore().Load()
	agent := settings.MatchAgentByCommand(*report.CommandLine, agentsFile)
	if agent != nil {
		if !agent.Hooks.Enabled {
			return
		}
	} else if !settings.GetBool(store, "terminal.agentHooks."+adapter.Kind+".enabled", true) {
		return
	}
	label := agentLabels[adapter.Kind]
	if agent != nil && strings.TrimSpace(agent.Name) != "" {
		label = agent.Name
	}
	if label == "" {
		label = adapter.Kind
	}
	wt := worktreeID
	tid := terminalID
	_, _ = Create(db, CreateInput{
		WorktreeID: &wt,
		TerminalID: &tid,
		Title:      fmt.Sprintf("%s finished", label),
		Body:       *report.CommandLine,
	})
}
