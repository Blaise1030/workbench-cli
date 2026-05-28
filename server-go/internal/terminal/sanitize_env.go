package terminal

import "regexp"

var sensitiveKeyRE = regexp.MustCompile(`(?i)token|secret|password|api_key`)

func SanitizeEnv(env map[string]string) map[string]string {
	out := make(map[string]string, len(env))
	for k, v := range env {
		if !sensitiveKeyRE.MatchString(k) {
			out[k] = v
		}
	}
	return out
}
