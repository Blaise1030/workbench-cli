package settings

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildNotifyCommand(t *testing.T) {
	cmd := BuildNotifyCommand(4740, "Claude Code", "Done")
	if cmd == "" {
		t.Fatal("empty command")
	}
	if !strings.Contains(cmd, `workbench-cli notify`) {
		t.Fatalf("command = %q", cmd)
	}
	if !strings.Contains(cmd, "WORKBENCH_WORKTREE_ID") || !strings.Contains(cmd, "WORKBENCH_TERMINAL_ID") {
		t.Fatalf("command should pass workbench session env: %q", cmd)
	}
	if strings.Contains(cmd, "notify--") {
		t.Fatalf("command missing spaces between notify and flags: %q", cmd)
	}
}

func TestAgentsStore_defaultsHooksDisabled(t *testing.T) {
	dir := t.TempDir()
	st := &AgentsStore{path: filepath.Join(dir, "agents.json")}
	resp := GetAgentsResponse(st, 4738)
	if len(resp.Agents) < 4 {
		t.Fatalf("expected builtin agents, got %d", len(resp.Agents))
	}
	for _, a := range resp.Agents {
		if a.Hooks.Enabled {
			t.Fatalf("agent %q hooks should be disabled by default", a.ID)
		}
	}
}

func TestAgentsStore_patchAndManifest(t *testing.T) {
	dir := t.TempDir()
	st := &AgentsStore{path: filepath.Join(dir, "agents.json")}
	_, err := st.Patch(PatchAgentsRequest{
		Agents: map[string]PatchWorkbenchAgent{
			"claude": {Hooks: &PatchAgentHooks{Enabled: ptrBool(true)}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	resp := GetAgentsResponse(st, 4740)
	m := resp.Manifests["claude"]
	if !m.Enabled || m.ClaudeHooks == nil {
		t.Fatalf("expected enabled claude manifest, got %#v", m)
	}
	if !strings.Contains(m.NotifyCommand, "workbench-cli notify") {
		t.Fatalf("notify command: %q", m.NotifyCommand)
	}
}

func TestApplyAgentNotifyHooks(t *testing.T) {
	dir := t.TempDir()
	home := filepath.Join(dir, "home")
	t.Setenv("HOME", home)

	st := &AgentsStore{path: filepath.Join(dir, "agents.json")}
	_, _ = st.Patch(PatchAgentsRequest{
		Agents: map[string]PatchWorkbenchAgent{
			"claude": {Hooks: &PatchAgentHooks{Enabled: ptrBool(true)}},
		},
	})

	path, backup, err := ApplyAgentNotifyHooks(st, "claude", 4738)
	if err != nil {
		t.Fatal(err)
	}
	if path == "" || backup == "" {
		t.Fatal("expected paths")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	body := string(raw)
	if !strings.Contains(body, `"hooks"`) || !strings.Contains(body, "workbench-cli notify") {
		t.Fatalf("unexpected settings content: %s", raw)
	}
}

func TestMatchAgentByCommand(t *testing.T) {
	file := AgentsFile{Agents: cloneBuiltinAgents()}
	a := MatchAgentByCommand("claude --resume abc", file)
	if a == nil || a.ID != "claude" {
		t.Fatalf("expected claude, got %#v", a)
	}
}

func TestResumeArgv(t *testing.T) {
	argv := ResumeArgv("claude --resume {{sessionId}}", "sess-1")
	if len(argv) != 3 || argv[2] != "sess-1" {
		t.Fatalf("unexpected argv: %v", argv)
	}
}

func ptrBool(v bool) *bool { return &v }
