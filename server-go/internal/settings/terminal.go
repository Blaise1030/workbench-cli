package settings

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	keyAutoResumeAgentSessions    = "terminal.autoResumeAgentSessions"
	keyPtyIdleTtlHours            = "terminal.ptyIdleTtlHours"
	keyScrollbackCapKb            = "terminal.scrollbackCapKb"
	keyScrollbackPersistOnShutdown = "terminal.scrollbackPersistOnShutdown"
	keyApprovedResumePrefixes     = "terminal.resumeCommands.approvedPrefixes"
)

var supportedAgentKinds = []string{"claude", "codex", "cursor", "gemini"}

func agentHookKey(kind string) string {
	return fmt.Sprintf("terminal.agentHooks.%s.enabled", kind)
}

type AgentHooks map[string]bool

type TerminalSettings struct {
	AutoResumeAgentSessions    bool       `json:"autoResumeAgentSessions"`
	PtyIdleTtlHours            int        `json:"ptyIdleTtlHours"`
	ScrollbackCapKb            int        `json:"scrollbackCapKb"`
	ScrollbackPersistOnShutdown bool      `json:"scrollbackPersistOnShutdown"`
	AgentHooks                 AgentHooks `json:"agentHooks"`
}

type ApprovedResumePrefix struct {
	ID         string            `json:"id"`
	Prefix     string            `json:"prefix"`
	Label      *string           `json:"label,omitempty"`
	Cwd        *string           `json:"cwd,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
	ApprovedAt int64             `json:"approvedAt"`
}

func GetTerminalSettings(s Store) TerminalSettings {
	hooks := make(AgentHooks)
	for _, kind := range supportedAgentKinds {
		hooks[kind] = GetBool(s, agentHookKey(kind), true)
	}
	return TerminalSettings{
		AutoResumeAgentSessions:    GetBool(s, keyAutoResumeAgentSessions, true),
		PtyIdleTtlHours:            GetInt(s, keyPtyIdleTtlHours, 24),
		ScrollbackCapKb:            GetInt(s, keyScrollbackCapKb, 4096),
		ScrollbackPersistOnShutdown: GetBool(s, keyScrollbackPersistOnShutdown, true),
		AgentHooks:                 hooks,
	}
}

type PatchTerminalSettings struct {
	AutoResumeAgentSessions    *bool      `json:"autoResumeAgentSessions,omitempty"`
	PtyIdleTtlHours            *int       `json:"ptyIdleTtlHours,omitempty"`
	ScrollbackCapKb            *int       `json:"scrollbackCapKb,omitempty"`
	ScrollbackPersistOnShutdown *bool     `json:"scrollbackPersistOnShutdown,omitempty"`
	AgentHooks                 AgentHooks `json:"agentHooks,omitempty"`
}

func PatchTerminalSettingsFn(s Store, patch PatchTerminalSettings) TerminalSettings {
	if patch.AutoResumeAgentSessions != nil {
		_ = s.Set(keyAutoResumeAgentSessions, *patch.AutoResumeAgentSessions)
	}
	if patch.PtyIdleTtlHours != nil {
		_ = s.Set(keyPtyIdleTtlHours, *patch.PtyIdleTtlHours)
	}
	if patch.ScrollbackCapKb != nil {
		_ = s.Set(keyScrollbackCapKb, *patch.ScrollbackCapKb)
	}
	if patch.ScrollbackPersistOnShutdown != nil {
		_ = s.Set(keyScrollbackPersistOnShutdown, *patch.ScrollbackPersistOnShutdown)
	}
	for kind, enabled := range patch.AgentHooks {
		_ = s.Set(agentHookKey(kind), enabled)
	}
	return GetTerminalSettings(s)
}

func ListApprovedResumePrefixes(s Store) []ApprovedResumePrefix {
	v, _ := s.Get(keyApprovedResumePrefixes, nil)
	if v == nil {
		return []ApprovedResumePrefix{}
	}
	// round-trip via JSON for type safety
	raw, _ := json.Marshal(v)
	var list []ApprovedResumePrefix
	_ = json.Unmarshal(raw, &list)
	if list == nil {
		return []ApprovedResumePrefix{}
	}
	return list
}

type CreateApprovedResumePrefix struct {
	Prefix string            `json:"prefix"`
	Label  *string           `json:"label,omitempty"`
	Cwd    *string           `json:"cwd,omitempty"`
	Env    map[string]string `json:"env,omitempty"`
}

func AddApprovedResumePrefix(s Store, input CreateApprovedResumePrefix) ApprovedResumePrefix {
	list := ListApprovedResumePrefixes(s)
	entry := ApprovedResumePrefix{
		ID:         uuid.NewString(),
		Prefix:     input.Prefix,
		Label:      input.Label,
		Cwd:        input.Cwd,
		Env:        input.Env,
		ApprovedAt: time.Now().UnixMilli(),
	}
	_ = s.Set(keyApprovedResumePrefixes, append(list, entry))
	return entry
}

func RevokeApprovedResumePrefix(s Store, id string) bool {
	list := ListApprovedResumePrefixes(s)
	next := make([]ApprovedResumePrefix, 0, len(list))
	for _, p := range list {
		if p.ID != id {
			next = append(next, p)
		}
	}
	if len(next) == len(list) {
		return false
	}
	_ = s.Set(keyApprovedResumePrefixes, next)
	return true
}

func ScrollbackCapBytes(capKb int) int {
	if capKb < 64 {
		capKb = 64
	}
	return capKb * 1024
}

func PtyIdleTtlMs(hours int) int64 {
	if hours < 1 {
		hours = 1
	}
	return int64(hours) * 60 * 60 * 1000
}
