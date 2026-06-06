package workspace

import "testing"

func TestNormalizePickedPath(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"  \n", ""},
		{"/tmp/repo\n", "/tmp/repo"},
		{"/tmp/repo/", "/tmp/repo"},
	}
	for _, tc := range tests {
		got := normalizePickedPath(tc.in)
		if tc.want == "" {
			if got != "" {
				t.Fatalf("normalizePickedPath(%q) = %q, want empty", tc.in, got)
			}
			continue
		}
		if got == "" {
			t.Fatalf("normalizePickedPath(%q) = empty, want non-empty", tc.in)
		}
	}
}
