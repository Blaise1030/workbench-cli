package terminal

import "regexp"

// sensitiveKeyRE matches environment variable names that may contain secrets.
// Checked case-insensitively against the key name.
var sensitiveKeyRE = regexp.MustCompile(
	`(?i)token|secret|password|api[_-]?key|private[_-]?key|credential|access[_-]?key`,
)

func SanitizeEnv(env map[string]string) map[string]string {
	out := make(map[string]string, len(env))
	for k, v := range env {
		if !sensitiveKeyRE.MatchString(k) {
			out[k] = v
		}
	}
	return out
}
