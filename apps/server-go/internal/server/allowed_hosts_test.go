package server

import (
	"os"
	"testing"
)

func TestBuildAllowedHosts_IncludesServerAndDevUI(t *testing.T) {
	t.Setenv("WORKBENCH_DEV_UI_PORT", "5173")
	hosts := buildAllowedHosts(4740, "workbench.local", nil)
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
	hosts := buildAllowedHosts(4738, "workbench.local", nil)
	if len(hosts) != 3 {
		t.Fatalf("got %v", hosts)
	}
}

func TestBuildAllowedHosts_IncludesLAN(t *testing.T) {
	hosts := buildAllowedHosts(4738, "workbench.local", []string{"192.168.1.42", "10.0.0.5"})
	found := map[string]bool{}
	for _, h := range hosts {
		found[h] = true
	}
	if !found["192.168.1.42:4738"] || !found["10.0.0.5:4738"] {
		t.Fatalf("expected LAN hosts in %v", hosts)
	}
}
