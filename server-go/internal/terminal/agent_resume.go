package terminal

import (
	"strconv"
	"strings"
)

func agentIsRunning(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "running", "thinking", "waiting":
		return true
	default:
		return false
	}
}

func argvToShellCommand(argv []string) string {
	parts := make([]string, len(argv))
	for i, a := range argv {
		parts[i] = strconv.Quote(a)
	}
	return strings.Join(parts, " ")
}

func (reg *Registry) agentResumeCommand(e *ptyEntry) (string, bool) {
	if reg.buildAgentResumeArgv == nil || reg.autoResumeAgentSessions == nil {
		return "", false
	}
	if !reg.autoResumeAgentSessions() {
		return "", false
	}
	if e.agentKind == nil || e.agentSessionID == nil {
		return "", false
	}
	kind := strings.TrimSpace(*e.agentKind)
	sessionID := strings.TrimSpace(*e.agentSessionID)
	if kind == "" || sessionID == "" {
		return "", false
	}
	if reg.agentHooksEnabled != nil && !reg.agentHooksEnabled(kind) {
		return "", false
	}
	if e.resumeCommand != nil && e.resumeTrusted && strings.TrimSpace(*e.resumeCommand) != "" {
		return "", false
	}
	argv := reg.buildAgentResumeArgv(kind, sessionID)
	if len(argv) == 0 {
		return "", false
	}
	return argvToShellCommand(argv), true
}

func (reg *Registry) shouldAutoResumeAgent(e *ptyEntry) (cmd string, ok bool) {
	cmd, ok = reg.agentResumeCommand(e)
	if !ok {
		return "", false
	}
	e.mu.Lock()
	running := agentIsRunning(e.agentStatus)
	attempted := e.agentResumeAttempted
	e.mu.Unlock()
	if running || attempted {
		return "", false
	}
	return cmd, true
}

func (e *ptyEntry) markAgentResumeAttempted() {
	e.mu.Lock()
	e.agentResumeAttempted = true
	e.mu.Unlock()
}
