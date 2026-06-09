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

// ClaudeHookEntry is the wrapper object Claude Code expects around hook commands.
type ClaudeHookEntry struct {
	Matcher string              `json:"matcher"`
	Hooks   []ClaudeHookCommand `json:"hooks"`
}

// BuildRegisterCommand returns a shell command that registers the agent session via workbench-cli.
// The session ID is read from stdin (Claude Code hook payload format).
func BuildRegisterCommand(agentID string) string {
	return fmt.Sprintf("workbench-cli register --source %s --state running || true", agentID)
}

func buildRegisterCmd(agentID, state string) string {
	return fmt.Sprintf("workbench-cli register --source %s --state %s || true", agentID, state)
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
	// State is the workbench status this event sets ("running", "idle", "needs_attention").
	// Empty means the event only sends a notification (no state change).
	State string `json:"state,omitempty"`
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
	ClaudeHooks   map[string][]ClaudeHookEntry `json:"claudeHooks,omitempty"`
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
		{ID: "SessionStart", Label: "Session start", Description: "Fired when a session begins.", State: "running"},
		{ID: "PreToolUse", Label: "Before tool", Description: "Fired before each tool call.", State: "running"},
		{ID: "UserPromptSubmit", Label: "Prompt submitted", Description: "Fired when you submit a prompt.", State: "running"},
		{ID: "PermissionRequest", Label: "Permission request", Description: "Fired when Claude asks for permission.", State: "needs_attention"},
		{ID: "Notification", Label: "Notification", Description: "Fired when Claude sends a notification. Also sends a desktop notification.", State: "needs_attention"},
		{ID: "Stop", Label: "Stop", Description: "Fired when the session stops. Also sends a desktop notification.", State: "idle"},
		{ID: "SubagentStop", Label: "Subagent stop", Description: "Fired when a subagent completes. Sends a desktop notification."},
	},
	"cursor": {
		{ID: "sessionStart", Label: "Session start", Description: "Fired when a Cursor agent session begins.", State: "running"},
		{ID: "beforeSubmitPrompt", Label: "Before submit", Description: "Fired when you submit a prompt.", State: "running"},
		{ID: "stop", Label: "Stop", Description: "Fired when the agent run completes. Also sends a desktop notification.", State: "idle"},
	},
	"codex": {
		{ID: "SessionStart", Label: "Session start", Description: "Fired when a session begins.", State: "running"},
		{ID: "UserPromptSubmit", Label: "Prompt submitted", Description: "Fired when you submit a prompt.", State: "running"},
		{ID: "Stop", Label: "Stop", Description: "Fired when the session ends. Also sends a desktop notification.", State: "idle"},
	},
	"gemini": {
		{ID: "SessionStart", Label: "Session start", Description: "Fired when a session begins.", State: "running"},
		{ID: "BeforeTool", Label: "Before tool", Description: "Fired before each tool call.", State: "running"},
		{ID: "BeforeAgent", Label: "Before agent", Description: "Fired before an agent run.", State: "running"},
		{ID: "AfterAgent", Label: "After agent", Description: "Fired when an agent completes. Also sends a desktop notification.", State: "idle"},
		{ID: "SessionEnd", Label: "Session end", Description: "Fired when the session ends. Also sends a desktop notification.", State: "idle"},
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
		ConfigPath: "~/.cursor/hooks.json", CanApplyHooks: true, Builtin: true,
		Hooks: defaultHooksForEvents(builtinHookEvents["cursor"], "Cursor Agent"),
	},
	{
		ID: "codex", Name: "Codex", Icon: "/agents/codex.svg", StartCommand: "codex",
		ResumeCommand: "codex resume {{sessionId}}", MatchBinaries: []string{"codex"},
		ConfigPath: "~/.codex/hooks.json", CanApplyHooks: true, Builtin: true,
		Hooks: defaultHooksForEvents(builtinHookEvents["codex"], "Codex"),
	},
	{
		ID: "gemini", Name: "Gemini CLI", Icon: "/agents/gemini.svg", StartCommand: "gemini",
		ResumeCommand: "gemini --resume {{sessionId}}", MatchBinaries: []string{"gemini"},
		ConfigPath: "~/.gemini/settings.json", CanApplyHooks: true, Builtin: true,
		Hooks: defaultHooksForEvents(builtinHookEvents["gemini"], "Gemini CLI"),
	},
}

func defaultHooksForEvents(events []AgentHookEventMeta, title string) AgentHooksConfig {
	return AgentHooksConfig{
		Enabled: false,
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

// buildClaudeStyleHooks generates the full hook set for an agent using Claude-format hook JSON.
// State events always get a register command; events that also notify append the notify command.
func buildClaudeStyleHooks(agentID string, events []AgentHookEventMeta, notifyCmd string) map[string][]ClaudeHookEntry {
	hooks := map[string][]ClaudeHookEntry{}
	for _, ev := range events {
		var cmds []ClaudeHookCommand
		if ev.State != "" {
			cmds = append(cmds, ClaudeHookCommand{Type: "command", Command: buildRegisterCmd(agentID, ev.State)})
		}
		// Send notification on idle/needs_attention events and pure notify events.
		if ev.State == "idle" || ev.State == "needs_attention" || ev.State == "" {
			cmds = append(cmds, ClaudeHookCommand{Type: "command", Command: notifyCmd + " || true"})
		}
		if len(cmds) > 0 {
			hooks[ev.ID] = []ClaudeHookEntry{{Matcher: "", Hooks: cmds}}
		}
	}
	return hooks
}

// buildCursorHooks generates hooks in the Cursor-specific format (no "type" field).
func buildCursorHooks(events []AgentHookEventMeta, notifyCmd string) map[string][]map[string]string {
	hooks := map[string][]map[string]string{}
	for _, ev := range events {
		var cmds []map[string]string
		if ev.State != "" {
			cmds = append(cmds, map[string]string{"command": buildRegisterCmd("cursor", ev.State)})
		}
		if ev.State == "idle" || ev.State == "needs_attention" || ev.State == "" {
			cmds = append(cmds, map[string]string{"command": notifyCmd + " || true"})
		}
		if len(cmds) > 0 {
			hooks[ev.ID] = cmds
		}
	}
	return hooks
}

func buildAgentManifest(a WorkbenchAgent, port int) AgentManifest {
	notifyCmd := BuildNotifyCommand(port, a.Hooks.Title, a.Hooks.Body)
	manifest := AgentManifest{
		Enabled:       a.Hooks.Enabled,
		NotifyCommand: notifyCmd,
	}
	if !a.Hooks.Enabled {
		manifest.InstallHint = "Enable hooks to generate install commands."
		return manifest
	}

	events, ok := builtinHookEvents[a.ID]
	if !ok {
		// Custom agent: generate a basic stop → idle + notify hook.
		events = []AgentHookEventMeta{
			{ID: "Stop", Label: "Stop", Description: "Session ends.", State: "idle"},
		}
	}

	if a.ID == "cursor" || strings.Contains(a.ConfigPath, ".cursor") {
		cursorHooks := buildCursorHooks(events, notifyCmd)
		merge := map[string]any{"version": 1, "hooks": cursorHooks}
		raw, _ := json.MarshalIndent(merge, "", "  ")
		manifest.SettingsMerge = string(raw)
		manifest.InstallHint = "Copy into " + a.ConfigPath + "."
		return manifest
	}

	// Claude, Codex, Gemini, and custom agents all use the Claude-style hook JSON.
	claudeHooks := buildClaudeStyleHooks(a.ID, events, notifyCmd)
	manifest.ClaudeHooks = claudeHooks
	var mergeRoot map[string]any
	if a.ID == "gemini" || strings.Contains(a.ConfigPath, ".gemini") {
		// Gemini merges hooks into settings.json under the "hooks" key.
		mergeRoot = map[string]any{"hooks": claudeHooks}
	} else {
		mergeRoot = map[string]any{"hooks": claudeHooks}
	}
	raw, _ := json.MarshalIndent(mergeRoot, "", "  ")
	manifest.SettingsMerge = string(raw)
	if a.ConfigPath != "" {
		manifest.InstallHint = "Merge the hooks object into " + a.ConfigPath + ", or use Sync config below."
	} else {
		manifest.InstallHint = "Merge the hooks object into your agent config, or use Sync config below."
	}
	return manifest
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

// ApplyAgentNotifyHooks writes the generated hook config to the agent's config file.
func ApplyAgentNotifyHooks(st *AgentsStore, agentID string, port int) (configPath string, backupPath string, err error) {
	agent, ok := st.GetAgent(agentID)
	if !ok {
		return "", "", fmt.Errorf("agent not found")
	}
	if !agent.Hooks.Enabled {
		return "", "", fmt.Errorf("hooks are disabled for %s", agent.Name)
	}
	if !agent.CanApplyHooks {
		return "", "", fmt.Errorf("sync is not supported for %s", agent.Name)
	}
	if strings.TrimSpace(agent.ConfigPath) == "" {
		return "", "", fmt.Errorf("no config path for %s", agent.Name)
	}
	manifest := buildAgentManifest(agent, port)
	if manifest.SettingsMerge == "" {
		return "", "", fmt.Errorf("no hooks generated for %s", agent.Name)
	}

	configPath, err = expandHome(agent.ConfigPath)
	if err != nil {
		return "", "", err
	}
	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		return "", "", err
	}

	backupPath = configPath + ".workbench.bak"
	if raw, readErr := os.ReadFile(configPath); readErr == nil {
		_ = os.WriteFile(backupPath, raw, 0o644)
	}

	// For cursor: write the full hooks file directly.
	if agent.ID == "cursor" || strings.Contains(agent.ConfigPath, ".cursor") {
		if err := os.WriteFile(configPath, []byte(manifest.SettingsMerge+"\n"), 0o644); err != nil {
			return "", "", err
		}
		return configPath, backupPath, nil
	}

	// For all others (Claude, Codex, Gemini): merge the hooks key into existing JSON.
	existing := map[string]any{}
	if raw, readErr := os.ReadFile(configPath); readErr == nil {
		_ = json.Unmarshal(raw, &existing)
	}

	var mergeDoc map[string]any
	if jsonErr := json.Unmarshal([]byte(manifest.SettingsMerge), &mergeDoc); jsonErr == nil {
		if h, ok := mergeDoc["hooks"]; ok {
			existing["hooks"] = h
		}
	}

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
