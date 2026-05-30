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
