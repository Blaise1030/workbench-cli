package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
)

// RunStatus posts an agent status update to the local hook endpoint.
// Called from Claude Code hooks to update the session's live status.
func RunStatus(argv []string) error {
	var state, worktreeID, terminalID string

	for i := 0; i < len(argv); i++ {
		switch argv[i] {
		case "--state":
			i++
			if i >= len(argv) {
				return fmt.Errorf("missing value for --state")
			}
			state = argv[i]
		case "--worktree-id":
			i++
			if i >= len(argv) {
				return fmt.Errorf("missing value for --worktree-id")
			}
			worktreeID = argv[i]
		case "--terminal-id":
			i++
			if i >= len(argv) {
				return fmt.Errorf("missing value for --terminal-id")
			}
			terminalID = argv[i]
		default:
			return fmt.Errorf("unknown option: %s", argv[i])
		}
	}

	if worktreeID == "" {
		worktreeID = strings.TrimSpace(os.Getenv(terminal.EnvWorkbenchWorktree))
	}
	if terminalID == "" {
		terminalID = strings.TrimSpace(os.Getenv(terminal.EnvWorkbenchTerminal))
	}

	state = strings.TrimSpace(state)
	if state == "" {
		return fmt.Errorf("--state is required (e.g. thinking, waiting, done)")
	}
	if terminalID == "" {
		return fmt.Errorf("terminal ID required (use --terminal-id or WORKBENCH_TERMINAL_ID env)")
	}

	port := notifyPort()
	url := fmt.Sprintf("http://127.0.0.1:%d/api/agent-status", port)

	payload := map[string]string{"terminalId": terminalID, "state": state}
	if worktreeID != "" {
		payload["worktreeId"] = worktreeID
	}
	raw, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("status request failed: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("status update failed: HTTP %d", res.StatusCode)
	}
	return nil
}
