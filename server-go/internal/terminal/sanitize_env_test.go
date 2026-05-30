package terminal

import "testing"

func TestSanitizeEnv_BlocksKnownSensitiveKeys(t *testing.T) {
	cases := []struct {
		key     string
		blocked bool
	}{
		{"TOKEN", true},
		{"SECRET", true},
		{"PASSWORD", true},
		{"API_KEY", true},
		{"ANTHROPIC_API_KEY", true},
		{"AWS_ACCESS_KEY_ID", true},
		{"AWS_SECRET_ACCESS_KEY", true},
		{"GITHUB_TOKEN", true},
		{"PRIVATE_KEY", true},
		{"CREDENTIAL", true},
		{"HOME", false},
		{"PATH", false},
		{"TERM", false},
		{"LANG", false},
		{"USER", false},
	}

	for _, tc := range cases {
		env := map[string]string{tc.key: "value"}
		got := SanitizeEnv(env)
		_, present := got[tc.key]
		if tc.blocked && present {
			t.Errorf("key %q should be filtered but was not", tc.key)
		}
		if !tc.blocked && !present {
			t.Errorf("key %q should be kept but was filtered", tc.key)
		}
	}
}

func TestSanitizeEnv_DashVariantsAndNearMisses(t *testing.T) {
	// Dash-separated variants must be blocked (regex uses [_-]? to cover them)
	blocked := []string{"API-KEY", "PRIVATE-KEY", "ACCESS-KEY"}
	for _, k := range blocked {
		env := map[string]string{k: "value"}
		got := SanitizeEnv(env)
		if _, present := got[k]; present {
			t.Errorf("key %q should be filtered but was not", k)
		}
	}

	// Safe keys that contain superficially similar substrings but don't match any pattern
	safe := []string{"APISERVER", "ACCESSOR", "LANGUAGES"}
	for _, k := range safe {
		env := map[string]string{k: "value"}
		got := SanitizeEnv(env)
		if _, present := got[k]; !present {
			t.Errorf("key %q should be kept but was filtered", k)
		}
	}
}
