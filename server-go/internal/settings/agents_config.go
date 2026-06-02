package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
	"github.com/google/uuid"
)

// AgentsConfigPath is ~/.workbench/agents.json.
func AgentsConfigPath() string {
	return filepath.Join(config.DataDir(), "agents.json")
}

// ClaudeHookCommand is one entry in Claude Code settings.json hooks.
type ClaudeHookCommand struct {
	Type    string `json:"type"`
	Command string `json:"command"`
}

// BuildNotifyCommand returns a shell command that posts to workbench-cli notify.
// Worktree/terminal/port are expanded from WORKBENCH_* env vars injected at PTY spawn.
func BuildNotifyCommand(_ int, title, body string) string {
	title = strings.TrimSpace(title)
	body = strings.TrimSpace(body)
	if title == "" {
		title = "Workbench"
	}
	if body == "" {
		body = "Done"
	}
	return fmt.Sprintf(
		`workbench-cli notify --worktree-id "$%s" --terminal-id "$%s" --title %q --body %q`,
		terminal.EnvWorkbenchWorktree,
		terminal.EnvWorkbenchTerminal,
		title,
		body,
	)
}

func expandHome(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("empty path")
	}
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, path[2:]), nil
	}
	return path, nil
}

// AgentHooksConfig is notify-hook settings for an agent.
type AgentHooksConfig struct {
	Enabled bool            `json:"enabled"`
	Events  map[string]bool   `json:"events"`
	Title   string            `json:"title"`
	Body    string            `json:"body"`
}

// WorkbenchAgent is one configured coding agent.
type WorkbenchAgent struct {
	ID            string           `json:"id"`
	Name          string           `json:"name"`
	Icon          string           `json:"icon,omitempty"`
	StartCommand  string           `json:"startCommand"`
	ResumeCommand string           `json:"resumeCommand"`
	MatchBinaries []string         `json:"matchBinaries,omitempty"`
	ConfigPath    string           `json:"configPath,omitempty"`
	CanApplyHooks bool             `json:"canApplyHooks,omitempty"`
	Builtin       bool             `json:"builtin,omitempty"`
	Hooks         AgentHooksConfig `json:"hooks"`
}

// AgentsFile is persisted to agents.json.
type AgentsFile struct {
	Agents []WorkbenchAgent `json:"agents"`
}

// AgentHookEventMeta describes a hook point for the UI.
type AgentHookEventMeta struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

// AgentResponseMeta is static UI metadata per agent id.
type AgentResponseMeta struct {
	ID              string               `json:"id"`
	SupportedEvents []AgentHookEventMeta `json:"supportedEvents"`
}

// AgentManifest is generated install material for hooks.
type AgentManifest struct {
	Enabled       bool                           `json:"enabled"`
	NotifyCommand string                         `json:"-"`
	ClaudeHooks   map[string][]ClaudeHookCommand `json:"claudeHooks,omitempty"`
	SettingsMerge string                         `json:"settingsMerge,omitempty"`
	InstallHint   string                         `json:"installHint,omitempty"`
}

// AgentsResponse is returned from GET /api/settings/agents.
type AgentsResponse struct {
	Agents    []WorkbenchAgent           `json:"agents"`
	Meta      map[string]AgentResponseMeta `json:"meta"`
	Manifests map[string]AgentManifest   `json:"manifests"`
	Port      int                        `json:"port"`
}

type PatchAgentHooks struct {
	Enabled *bool           `json:"enabled,omitempty"`
	Events  map[string]bool `json:"events,omitempty"`
	Title   *string         `json:"title,omitempty"`
	Body    *string         `json:"body,omitempty"`
}

type PatchWorkbenchAgent struct {
	Name          *string          `json:"name,omitempty"`
	StartCommand  *string          `json:"startCommand,omitempty"`
	ResumeCommand *string          `json:"resumeCommand,omitempty"`
	MatchBinaries []string         `json:"matchBinaries,omitempty"`
	Hooks         *PatchAgentHooks `json:"hooks,omitempty"`
}

type CreateWorkbenchAgent struct {
	Name          string `json:"name"`
	StartCommand  string `json:"startCommand"`
	ResumeCommand string `json:"resumeCommand"`
	MatchBinaries []string `json:"matchBinaries,omitempty"`
}

type PatchAgentsRequest struct {
	Agents map[string]PatchWorkbenchAgent `json:"agents,omitempty"`
}

// AgentsStore reads and writes ~/.workbench/agents.json.
type AgentsStore struct {
	mu   sync.Mutex
	path string
}

func NewAgentsStore() *AgentsStore {
	return &AgentsStore{path: AgentsConfigPath()}
}

var builtinHookEvents = map[string][]AgentHookEventMeta{
	"claude": {
		{ID: "Stop", Label: "Stop", Description: "When the main agent finishes a turn or session stops."},
		{ID: "SubagentStop", Label: "Subagent stop", Description: "When a subagent completes."},
		{ID: "Notification", Label: "Notification", Description: "When Claude sends a notification (e.g. permission prompt)."},
	},
	"cursor": {
		{ID: "Stop", Label: "Stop", Description: "When the agent run completes (if your Cursor build supports hooks)."},
	},
	"codex": {
		{ID: "Stop", Label: "Stop", Description: "Run when a Codex session ends (manual or wrapper script)."},
	},
	"gemini": {
		{ID: "Stop", Label: "Stop", Description: "Run when a Gemini CLI session ends (manual or wrapper script)."},
	},
}

var defaultBuiltinAgents = []WorkbenchAgent{
	{
		ID: "claude", Name: "Claude Code", Icon: "/agents/claude.svg", StartCommand: "claude",
		ResumeCommand: "claude --resume {{sessionId}}", MatchBinaries: []string{"claude"},
		ConfigPath: "~/.claude/settings.json", CanApplyHooks: true, Builtin: true,
		Hooks: defaultHooksForEvents(builtinHookEvents["claude"], "Claude Code"),
	},
	{
		ID: "cursor", Name: "Cursor Agent", Icon: "/agents/cursor.svg", StartCommand: "agent",
		ResumeCommand: "agent --resume {{sessionId}}", MatchBinaries: []string{"agent", "cursor-agent"},
		ConfigPath: "~/.cursor/hooks.json", Builtin: true,
		Hooks: defaultHooksForEvents(builtinHookEvents["cursor"], "Cursor Agent"),
	},
	{
		ID: "codex", Name: "Codex", Icon: "/agents/codex.svg", StartCommand: "codex",
		ResumeCommand: "codex resume {{sessionId}}", MatchBinaries: []string{"codex"},
		Builtin: true,
		Hooks: defaultHooksForEvents(builtinHookEvents["codex"], "Codex"),
	},
	{
		ID: "gemini", Name: "Gemini CLI", Icon: "/agents/gemini.svg", StartCommand: "gemini",
		ResumeCommand: "gemini --resume {{sessionId}}", MatchBinaries: []string{"gemini"},
		Builtin: true,
		Hooks: defaultHooksForEvents(builtinHookEvents["gemini"], "Gemini CLI"),
	},
}

func defaultHooksForEvents(events []AgentHookEventMeta, title string) AgentHooksConfig {
	evMap := make(map[string]bool)
	for _, ev := range events {
		evMap[ev.ID] = ev.ID == "Stop"
	}
	return AgentHooksConfig{
		Enabled: false,
		Events:  evMap,
		Title:   title,
		Body:    "Session finished",
	}
}

func (st *AgentsStore) Load() AgentsFile {
	st.mu.Lock()
	defer st.mu.Unlock()
	return st.loadLocked()
}

func (st *AgentsStore) loadLocked() AgentsFile {
	raw, err := os.ReadFile(st.path)
	if err != nil {
		return AgentsFile{Agents: cloneBuiltinAgents()}
	}
	var file AgentsFile
	if err := json.Unmarshal(raw, &file); err != nil || len(file.Agents) == 0 {
		return AgentsFile{Agents: cloneBuiltinAgents()}
	}
	return mergeAgentsWithDefaults(file)
}

func cloneBuiltinAgents() []WorkbenchAgent {
	out := make([]WorkbenchAgent, len(defaultBuiltinAgents))
	copy(out, defaultBuiltinAgents)
	return out
}

func mergeAgentsWithDefaults(file AgentsFile) AgentsFile {
	byID := make(map[string]WorkbenchAgent)
	for _, a := range file.Agents {
		byID[a.ID] = a
	}
	var merged []WorkbenchAgent
	for _, def := range defaultBuiltinAgents {
		cur, ok := byID[def.ID]
		if !ok {
			merged = append(merged, def)
			continue
		}
		merged = append(merged, mergeAgent(def, cur))
		delete(byID, def.ID)
	}
	for _, custom := range byID {
		if custom.ID == "" {
			continue
		}
		merged = append(merged, normalizeCustomAgent(custom))
	}
	return AgentsFile{Agents: merged}
}

func mergeAgent(def, cur WorkbenchAgent) WorkbenchAgent {
	cur.Builtin = true
	if strings.TrimSpace(cur.Name) == "" {
		cur.Name = def.Name
	}
	if strings.TrimSpace(cur.StartCommand) == "" {
		cur.StartCommand = def.StartCommand
	}
	if strings.TrimSpace(cur.ResumeCommand) == "" {
		cur.ResumeCommand = def.ResumeCommand
	}
	if strings.TrimSpace(cur.Icon) == "" {
		cur.Icon = def.Icon
	}
	if len(cur.MatchBinaries) == 0 {
		cur.MatchBinaries = def.MatchBinaries
	}
	if cur.ConfigPath == "" {
		cur.ConfigPath = def.ConfigPath
	}
	cur.CanApplyHooks = def.CanApplyHooks
	cur.Hooks = mergeHooks(def.Hooks, cur.Hooks, def.Name)
	return cur
}

func mergeHooks(def, cur AgentHooksConfig, label string) AgentHooksConfig {
	if cur.Events == nil {
		cur.Events = def.Events
	} else {
		for evID, enabled := range def.Events {
			if _, exists := cur.Events[evID]; !exists {
				cur.Events[evID] = enabled
			}
		}
	}
	if strings.TrimSpace(cur.Title) == "" {
		cur.Title = label
	}
	if strings.TrimSpace(cur.Body) == "" {
		cur.Body = def.Body
	}
	return cur
}

func normalizeCustomAgent(a WorkbenchAgent) WorkbenchAgent {
	if a.Hooks.Events == nil {
		a.Hooks = defaultHooksForEvents(genericHookEvents(), a.Name)
	}
	if strings.TrimSpace(a.Hooks.Title) == "" {
		a.Hooks.Title = a.Name
	}
	if strings.TrimSpace(a.Hooks.Body) == "" {
		a.Hooks.Body = "Session finished"
	}
	return a
}

func genericHookEvents() []AgentHookEventMeta {
	return []AgentHookEventMeta{
		{ID: "Stop", Label: "Stop", Description: "When the agent session ends."},
	}
}

func (st *AgentsStore) Save(file AgentsFile) error {
	st.mu.Lock()
	defer st.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(st.path), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(st.path, append(raw, '\n'), 0o644)
}

func (st *AgentsStore) GetAgent(id string) (WorkbenchAgent, bool) {
	file := st.Load()
	for _, a := range file.Agents {
		if a.ID == id {
			return a, true
		}
	}
	return WorkbenchAgent{}, false
}

func (st *AgentsStore) Patch(patch PatchAgentsRequest) (AgentsFile, error) {
	file := st.Load()
	byID := make(map[string]*WorkbenchAgent, len(file.Agents))
	for i := range file.Agents {
		byID[file.Agents[i].ID] = &file.Agents[i]
	}
	for id, p := range patch.Agents {
		agent, ok := byID[id]
		if !ok {
			continue
		}
		if p.Name != nil && strings.TrimSpace(*p.Name) != "" {
			agent.Name = strings.TrimSpace(*p.Name)
		}
		if p.StartCommand != nil {
			agent.StartCommand = strings.TrimSpace(*p.StartCommand)
		}
		if p.ResumeCommand != nil {
			agent.ResumeCommand = strings.TrimSpace(*p.ResumeCommand)
		}
		if p.MatchBinaries != nil {
			agent.MatchBinaries = p.MatchBinaries
		}
		if p.Hooks != nil {
			agent.Hooks = patchHooks(agent.Hooks, *p.Hooks, agent.Name)
		}
	}
	if err := st.Save(file); err != nil {
		return AgentsFile{}, err
	}
	return file, nil
}

func patchHooks(prev AgentHooksConfig, patch PatchAgentHooks, label string) AgentHooksConfig {
	if patch.Events != nil {
		if prev.Events == nil {
			prev.Events = map[string]bool{}
		}
		for ev, on := range patch.Events {
			prev.Events[ev] = on
		}
	}
	if patch.Enabled != nil {
		prev.Enabled = *patch.Enabled
	}
	if patch.Title != nil && strings.TrimSpace(*patch.Title) != "" {
		prev.Title = strings.TrimSpace(*patch.Title)
	}
	if patch.Body != nil && strings.TrimSpace(*patch.Body) != "" {
		prev.Body = strings.TrimSpace(*patch.Body)
	}
	if strings.TrimSpace(prev.Title) == "" {
		prev.Title = label
	}
	return prev
}

func (st *AgentsStore) Create(input CreateWorkbenchAgent) (WorkbenchAgent, error) {
	name := strings.TrimSpace(input.Name)
	start := strings.TrimSpace(input.StartCommand)
	resume := strings.TrimSpace(input.ResumeCommand)
	if name == "" || start == "" || resume == "" {
		return WorkbenchAgent{}, fmt.Errorf("name, startCommand, and resumeCommand are required")
	}
	binaries := input.MatchBinaries
	if len(binaries) == 0 {
		binaries = []string{firstToken(start)}
	}
	agent := WorkbenchAgent{
		ID:            uuid.New().String(),
		Name:          name,
		StartCommand:  start,
		ResumeCommand: resume,
		MatchBinaries: binaries,
		Hooks:         defaultHooksForEvents(genericHookEvents(), name),
	}
	file := st.Load()
	file.Agents = append(file.Agents, agent)
	if err := st.Save(file); err != nil {
		return WorkbenchAgent{}, err
	}
	return agent, nil
}

func (st *AgentsStore) Delete(id string) error {
	file := st.Load()
	var next []WorkbenchAgent
	found := false
	for _, a := range file.Agents {
		if a.ID == id {
			if a.Builtin {
				return fmt.Errorf("cannot delete built-in agent %q", id)
			}
			found = true
			continue
		}
		next = append(next, a)
	}
	if !found {
		return fmt.Errorf("agent not found")
	}
	file.Agents = next
	return st.Save(file)
}

func firstToken(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	if cmd == "" {
		return ""
	}
	if i := strings.IndexAny(cmd, " \t"); i >= 0 {
		return cmd[:i]
	}
	return cmd
}

func hookMetaForAgent(a WorkbenchAgent) AgentResponseMeta {
	if events, ok := builtinHookEvents[a.ID]; ok {
		return AgentResponseMeta{ID: a.ID, SupportedEvents: events}
	}
	return AgentResponseMeta{ID: a.ID, SupportedEvents: genericHookEvents()}
}

func buildAgentManifest(a WorkbenchAgent, port int) AgentManifest {
	cmd := BuildNotifyCommand(port, a.Hooks.Title, a.Hooks.Body)
	manifest := AgentManifest{
		Enabled:       a.Hooks.Enabled,
		NotifyCommand: cmd,
	}
	if !a.Hooks.Enabled {
		manifest.InstallHint = "Enable notify hooks to generate install commands."
		return manifest
	}

	if a.ID == "claude" || (a.CanApplyHooks && strings.Contains(a.ConfigPath, ".claude")) {
		hooks := map[string][]ClaudeHookCommand{}
		for evID, on := range a.Hooks.Events {
			if !on {
				continue
			}
			hooks[evID] = []ClaudeHookCommand{{Type: "command", Command: cmd}}
		}
		manifest.ClaudeHooks = hooks
		merge := map[string]any{"hooks": hooks}
		raw, _ := json.MarshalIndent(merge, "", "  ")
		manifest.SettingsMerge = string(raw)
		manifest.InstallHint = "Merge the hooks object into " + a.ConfigPath + ", or use Apply below."
		return manifest
	}

	if a.ID == "cursor" || strings.Contains(a.ConfigPath, ".cursor") {
		merge := map[string]any{
			"version": 1,
			"hooks":   buildGenericHookMapFromEvents(a.Hooks.Events, cmd),
		}
		raw, _ := json.MarshalIndent(merge, "", "  ")
		manifest.SettingsMerge = string(raw)
		manifest.InstallHint = "Copy into " + a.ConfigPath + " when your Cursor build supports agent hooks."
		return manifest
	}

	manifest.InstallHint = fmt.Sprintf("Run on session end:\n  %s", cmd)
	return manifest
}

func buildGenericHookMapFromEvents(events map[string]bool, cmd string) map[string][]ClaudeHookCommand {
	out := map[string][]ClaudeHookCommand{}
	for evID, on := range events {
		if !on {
			continue
		}
		out[evID] = []ClaudeHookCommand{{Type: "command", Command: cmd}}
	}
	return out
}

func GetAgentsResponse(st *AgentsStore, port int) AgentsResponse {
	file := st.Load()
	meta := make(map[string]AgentResponseMeta)
	manifests := make(map[string]AgentManifest)
	for _, a := range file.Agents {
		meta[a.ID] = hookMetaForAgent(a)
		manifests[a.ID] = buildAgentManifest(a, port)
	}
	return AgentsResponse{
		Agents:    file.Agents,
		Meta:      meta,
		Manifests: manifests,
		Port:      port,
	}
}

// ApplyAgentNotifyHooks merges generated hooks into the agent config file (Claude today).
func ApplyAgentNotifyHooks(st *AgentsStore, agentID string, port int) (configPath string, backupPath string, err error) {
	agent, ok := st.GetAgent(agentID)
	if !ok {
		return "", "", fmt.Errorf("agent not found")
	}
	if !agent.Hooks.Enabled {
		return "", "", fmt.Errorf("notify hooks are disabled for %s", agent.Name)
	}
	if !agent.CanApplyHooks && agent.ID != "claude" {
		return "", "", fmt.Errorf("apply is not supported for %s", agent.Name)
	}
	manifest := buildAgentManifest(agent, port)
	if len(manifest.ClaudeHooks) == 0 {
		return "", "", fmt.Errorf("no hook events selected")
	}
	if strings.TrimSpace(agent.ConfigPath) == "" {
		return "", "", fmt.Errorf("no config path for %s", agent.Name)
	}

	configPath, err = expandHome(agent.ConfigPath)
	if err != nil {
		return "", "", err
	}
	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		return "", "", err
	}

	existing := map[string]any{}
	if raw, readErr := os.ReadFile(configPath); readErr == nil {
		_ = json.Unmarshal(raw, &existing)
	}

	backupPath = configPath + ".workbench.bak"
	if raw, readErr := os.ReadFile(configPath); readErr == nil {
		_ = os.WriteFile(backupPath, raw, 0o644)
	}

	hooksVal, ok := existing["hooks"]
	hooks := map[string]any{}
	if ok {
		if m, ok := hooksVal.(map[string]any); ok {
			hooks = m
		}
	}
	for ev, entries := range manifest.ClaudeHooks {
		var list []any
		for _, e := range entries {
			list = append(list, map[string]string{"type": e.Type, "command": e.Command})
		}
		hooks[ev] = list
	}
	existing["hooks"] = hooks

	out, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return "", "", err
	}
	if err := os.WriteFile(configPath, append(out, '\n'), 0o644); err != nil {
		return "", "", err
	}
	return configPath, backupPath, nil
}

// MatchAgentByCommand finds an agent whose binary matches the command line.
func MatchAgentByCommand(commandLine string, file AgentsFile) *WorkbenchAgent {
	invocation := extractInvocation(commandLine)
	if invocation == "" {
		return nil
	}
	for i := range file.Agents {
		a := &file.Agents[i]
		for _, bin := range a.MatchBinaries {
			if bin == invocation {
				return a
			}
		}
	}
	return nil
}

func extractInvocation(commandLine string) string {
	trimmed := strings.TrimSpace(commandLine)
	if trimmed == "" {
		return ""
	}
	if i := strings.IndexAny(trimmed, " \t|;&"); i >= 0 {
		trimmed = trimmed[:i]
	}
	if idx := strings.LastIndex(trimmed, "/"); idx >= 0 {
		return trimmed[idx+1:]
	}
	return trimmed
}

// ResumeArgv splits resumeCommand with {{sessionId}} replaced.
func ResumeArgv(resumeCommand, sessionID string) []string {
	cmd := strings.ReplaceAll(resumeCommand, "{{sessionId}}", sessionID)
	return strings.Fields(cmd)
}
