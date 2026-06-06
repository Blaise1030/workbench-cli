package server

import (
	"os"
	"testing"
)

func TestBuildAllowedHosts_IncludesServerAndDevUI(t *testing.T) {
	t.Setenv("WORKBENCH_DEV_UI_PORT", "5173")
	hosts := buildAllowedHosts(4740, "workbench.local")
	want := map[string]bool{
		"localhost:4740":       true,
		"127.0.0.1:4740":       true,
		"workbench.local:4740": true,
		"localhost:5173":       true,
		"127.0.0.1:5173":       true,
	}
	if len(hosts) != len(want) {
		t.Fatalf("got %d hosts %v, want %d", len(hosts), hosts, len(want))
	}
	for _, h := range hosts {
		if !want[h] {
			t.Errorf("unexpected host %q", h)
		}
	}
}

func TestBuildAllowedHosts_NoDevPort(t *testing.T) {
	os.Unsetenv("WORKBENCH_DEV_UI_PORT")
	hosts := buildAllowedHosts(4738, "workbench.local")
	if len(hosts) != 3 {
		t.Fatalf("got %v", hosts)
	}
}
