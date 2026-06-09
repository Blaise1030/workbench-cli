package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
)

// hookPayload is the subset of agent hook stdin JSON we care about.
// Claude Code and Gemini CLI send session_id; Cursor native hooks send conversation_id.
type hookPayload struct {
	SessionID      string `json:"session_id"`
	ConversationID string `json:"conversation_id"`
}

// RunRegister registers the current terminal as an agent session.
// Intended to be called from agent hooks (e.g. Claude Code PreToolUse hook).
// Example: workbench-cli register --source claude --state running
func RunRegister(argv []string) error {
	var source, sessionID, state, worktreeID, terminalID string

	parseFlag := func(flag, arg string, i *int, argv []string) (string, error) {
		if v, ok := strings.CutPrefix(arg, flag+"="); ok {
			return v, nil
		}
		*i++
		if *i >= len(argv) {
			return "", fmt.Errorf("missing value for %s", flag)
		}
		return argv[*i], nil
	}

	for i := 0; i < len(argv); i++ {
		arg := argv[i]
		switch {
		case arg == "--source" || strings.HasPrefix(arg, "--source="):
			v, err := parseFlag("--source", arg, &i, argv)
			if err != nil {
				return err
			}
			source = v
		case arg == "--session-id" || strings.HasPrefix(arg, "--session-id="):
			v, err := parseFlag("--session-id", arg, &i, argv)
			if err != nil {
				return err
			}
			sessionID = v
		case arg == "--state" || strings.HasPrefix(arg, "--state="):
			v, err := parseFlag("--state", arg, &i, argv)
			if err != nil {
				return err
			}
			state = v
		case arg == "--worktree-id" || strings.HasPrefix(arg, "--worktree-id="):
			v, err := parseFlag("--worktree-id", arg, &i, argv)
			if err != nil {
				return err
			}
			worktreeID = v
		case arg == "--terminal-id" || strings.HasPrefix(arg, "--terminal-id="):
			v, err := parseFlag("--terminal-id", arg, &i, argv)
			if err != nil {
				return err
			}
			terminalID = v
		default:
			return fmt.Errorf("unknown option: %s", arg)
		}
	}

	if worktreeID == "" {
		worktreeID = strings.TrimSpace(os.Getenv(terminal.EnvWorkbenchWorktree))
	}
	if terminalID == "" {
		terminalID = strings.TrimSpace(os.Getenv(terminal.EnvWorkbenchTerminal))
	}

	source = strings.TrimSpace(source)
	if source == "" {
		return fmt.Errorf("--source is required (e.g. claude, cursor, codex)")
	}
	if terminalID == "" {
		return nil // not inside a Workbench PTY session; nothing to register
	}

	// If no --session-id given, try env vars then stdin JSON (Claude + Cursor + Gemini formats).
	if sessionID == "" {
		sessionID = resolveHookSessionID(
			os.Getenv("CLAUDE_CODE_SESSION_ID"),
			os.Getenv("CURSOR_SESSION_ID"),
			os.Getenv("GEMINI_SESSION_ID"),
			os.Stdin,
		)
	}

	port := notifyPort()
	url := fmt.Sprintf("http://127.0.0.1:%d/api/register", port)

	payload := map[string]string{
		"terminalId": terminalID,
		"source":     source,
	}
	if worktreeID != "" {
		payload["worktreeId"] = worktreeID
	}
	if sessionID != "" {
		payload["sessionId"] = sessionID
	}
	if state != "" {
		payload["state"] = state
	}
	raw, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("register request failed: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("register failed: HTTP %d", res.StatusCode)
	}
	return nil
}

func resolveHookSessionID(claudeEnv, cursorEnv, geminiEnv string, stdin interface {
	Read([]byte) (int, error)
}) string {
	if s := strings.TrimSpace(claudeEnv); s != "" {
		return s
	}
	if s := strings.TrimSpace(cursorEnv); s != "" {
		return s
	}
	if s := strings.TrimSpace(geminiEnv); s != "" {
		return s
	}
	raw, err := io.ReadAll(stdin)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var payload hookPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}
	if s := strings.TrimSpace(payload.ConversationID); s != "" {
		return s
	}
	return strings.TrimSpace(payload.SessionID)
}
