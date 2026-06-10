package terminal

import "testing"

func newTestRegistry() *Registry {
	return NewRegistry(RegistryConfig{})
}

func TestSetAgentStatusIf_FlipsFromMatchingState(t *testing.T) {
	reg := newTestRegistry()
	reg.getOrCreate("term-1", "wt-1", "Terminal", "", nil, false, nil, nil)
	reg.SetAgentStatus("term-1", "needs_attention")

	changed := reg.SetAgentStatusIf("term-1", "needs_attention", "idle")
	if !changed {
		t.Fatalf("expected changed=true when current status matches want")
	}
	status, _ := reg.GetAgentStatus("term-1")
	if status != "idle" {
		t.Fatalf("expected status=idle, got %q", status)
	}
}

func TestSetAgentStatusIf_NoOpWhenStateDiffers(t *testing.T) {
	reg := newTestRegistry()
	reg.getOrCreate("term-1", "wt-1", "Terminal", "", nil, false, nil, nil)
	reg.SetAgentStatus("term-1", "running")

	changed := reg.SetAgentStatusIf("term-1", "needs_attention", "idle")
	if changed {
		t.Fatalf("expected changed=false when current status does not match want")
	}
	status, _ := reg.GetAgentStatus("term-1")
	if status != "running" {
		t.Fatalf("expected status unchanged (running), got %q", status)
	}
}

func TestSetAgentStatusIf_NoOpWhenTerminalMissing(t *testing.T) {
	reg := newTestRegistry()
	if reg.SetAgentStatusIf("missing", "needs_attention", "idle") {
		t.Fatalf("expected changed=false for unknown terminal")
	}
}
