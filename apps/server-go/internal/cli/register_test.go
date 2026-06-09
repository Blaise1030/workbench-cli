package cli

import (
	"strings"
	"testing"
)

func TestResolveHookSessionID(t *testing.T) {
	tests := []struct {
		name      string
		claudeEnv string
		cursorEnv string
		geminiEnv string
		stdin     string
		want      string
	}{
		{
			name:      "claude env wins",
			claudeEnv: "claude-sess",
			cursorEnv: "cursor-sess",
			geminiEnv: "gemini-sess",
			stdin:     `{"conversation_id":"stdin-sess"}`,
			want:      "claude-sess",
		},
		{
			name:      "cursor env when no claude env",
			cursorEnv: "cursor-sess",
			stdin:     `{"conversation_id":"stdin-sess"}`,
			want:      "cursor-sess",
		},
		{
			name:      "gemini env when no claude or cursor env",
			geminiEnv: "gemini-uuid",
			stdin:     `{"session_id":"stdin-sess"}`,
			want:      "gemini-uuid",
		},
		{
			name:  "cursor conversation_id from stdin",
			stdin: `{"conversation_id":"conv-123","session_id":"sess-456"}`,
			want:  "conv-123",
		},
		{
			name:  "gemini session_id from stdin",
			stdin: `{"session_id":"sess-456"}`,
			want:  "sess-456",
		},
		{
			name:  "empty stdin",
			stdin: "",
			want:  "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveHookSessionID(tc.claudeEnv, tc.cursorEnv, tc.geminiEnv, strings.NewReader(tc.stdin))
			if got != tc.want {
				t.Fatalf("resolveHookSessionID() = %q, want %q", got, tc.want)
			}
		})
	}
}
