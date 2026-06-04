package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
)

// RunNotify posts a notification to the local hook endpoint (for Claude Code hooks).
// Worktree and terminal IDs are taken from flags or WORKBENCH_* env (set in Workbench PTY sessions).
// See https://cmux.com/docs/notifications and docs/notifications.md.
func RunNotify(argv []string) error {
	title := "Workbench"
	body := "Done"
	var worktreeID, terminalID string

	for i := 0; i < len(argv); i++ {
		switch argv[i] {
		case "--title":
			i++
			if i >= len(argv) {
				return fmt.Errorf("missing value for --title")
			}
			title = argv[i]
		case "--body":
			i++
			if i >= len(argv) {
				return fmt.Errorf("missing value for --body")
			}
			body = argv[i]
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
	terminalName := strings.TrimSpace(os.Getenv(terminal.EnvWorkbenchTerminalName))

	title = strings.TrimSpace(title)
	body = strings.TrimSpace(body)
	if title == "" || body == "" {
		return fmt.Errorf("title and body are required")
	}

	port := notifyPort()
	url := fmt.Sprintf("http://127.0.0.1:%d/api/notify", port)

	payload := map[string]string{
		"title": title,
		"body":  body,
	}
	if worktreeID != "" {
		payload["worktreeId"] = worktreeID
	}
	if terminalID != "" {
		payload["terminalId"] = terminalID
	}
	if terminalName != "" {
		payload["subtitle"] = terminalName
	}
	raw, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("notify request failed: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("notify failed: HTTP %d", res.StatusCode)
	}
	return nil
}

func notifyPort() int {
	if envPort := strings.TrimSpace(os.Getenv(terminal.EnvWorkbenchPort)); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil && p > 0 {
			return p
		}
	}
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil && p > 0 {
			return p
		}
	}
	if devPort := os.Getenv("WORKBENCH_GO_PORT"); devPort != "" {
		if p, err := strconv.Atoi(devPort); err == nil && p > 0 {
			return p
		}
	}
	return config.LoadNetworkConfig().Port
}
