package agents

import (
	"regexp"
	"strings"
)

var envAssignRE = regexp.MustCompile(`^(?:\s*[A-Za-z_][A-Za-z0-9_]*=\S*\s*)+`)

func ExtractInvocation(commandLine string) string {
	trimmed := strings.TrimSpace(commandLine)
	if trimmed == "" {
		return ""
	}
	for i := 0; i < 8; i++ {
		without := envAssignRE.ReplaceAllString(trimmed, "")
		if without != trimmed {
			trimmed = strings.TrimSpace(without)
			continue
		}
		if strings.HasPrefix(trimmed, "env ") {
			trimmed = strings.TrimSpace(trimmed[4:])
			continue
		}
		break
	}
	re := regexp.MustCompile(`^([^\s|;&]+)`)
	m := re.FindStringSubmatch(trimmed)
	if m == nil {
		return ""
	}
	token := m[1]
	if idx := strings.LastIndex(token, "/"); idx >= 0 {
		return token[idx+1:]
	}
	return token
}

func MatchAdapter(commandLine string) *Adapter {
	invocation := ExtractInvocation(commandLine)
	if invocation == "" {
		return nil
	}
	for i := range Adapters {
		for _, bin := range Adapters[i].Binaries {
			if bin == invocation {
				return &Adapters[i]
			}
		}
	}
	return nil
}

func BuildResumeArgv(kind, sessionID string) []string {
	for i := range Adapters {
		if Adapters[i].Kind == kind {
			return Adapters[i].ResumeArgs(sessionID)
		}
	}
	return nil
}
