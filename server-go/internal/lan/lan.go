package lan

import (
	"fmt"
	"sync"

	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
)

type BindMode string

const (
	ModeLocalhost BindMode = "localhost"
	ModeLAN       BindMode = "lan"
)

// Manager implements both appstate.LanManager and settings.LanProvider.
type Manager struct {
	mu        sync.RWMutex
	mode      BindMode
	invite    *auth.InviteToken
	lanIP     string
	urlScheme string
	port      int
	localHost string
}

func New(port int, localHost string, forceHTTP bool) *Manager {
	scheme := "https"
	if forceHTTP {
		scheme = "http"
	}
	return &Manager{
		mode:      ModeLocalhost,
		urlScheme: scheme,
		port:      port,
		localHost: localHost,
	}
}

// appstate.LanManager
func (m *Manager) GetInvite() *auth.InviteToken {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.invite
}

// settings.LanProvider
func (m *Manager) GetPublicState() settings.LanPublicState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.mode != ModeLAN || m.lanIP == "" || m.invite == nil {
		return settings.LanPublicState{Enabled: false}
	}
	inviteVal := m.invite.Value
	expiresAt := m.invite.ExpiresAt.UnixMilli()
	lanURL := fmt.Sprintf("%s://%s:%d/?invite=%s", m.urlScheme, m.lanIP, m.port, inviteVal)
	return settings.LanPublicState{
		Enabled:         true,
		LanURL:          &lanURL,
		InviteExpiresAt: &expiresAt,
	}
}

func (m *Manager) Mode() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return string(m.mode)
}

func (m *Manager) Enable(lanIP string) {
	m.mu.Lock()
	m.mode = ModeLAN
	m.lanIP = lanIP
	m.invite = auth.CreateInvite()
	m.mu.Unlock()
}

func (m *Manager) Disable() {
	m.mu.Lock()
	m.mode = ModeLocalhost
	m.lanIP = ""
	m.invite = nil
	m.mu.Unlock()
}

func (m *Manager) RefreshInvite() {
	m.mu.Lock()
	m.invite = auth.CreateInvite()
	m.mu.Unlock()
}

func (m *Manager) GetLocalURL() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return fmt.Sprintf("%s://%s:%d/", m.urlScheme, m.localHost, m.port)
}

func (m *Manager) GetURLScheme() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.urlScheme
}

func (m *Manager) GetLocalHost() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.localHost
}

func (m *Manager) Port() int {
	return m.port
}

func (m *Manager) SetURLScheme(scheme string) {
	m.mu.Lock()
	m.urlScheme = scheme
	m.mu.Unlock()
}

func (m *Manager) GetHostname() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.mode == ModeLAN {
		return "0.0.0.0"
	}
	return "127.0.0.1"
}

func (m *Manager) GetTLSHosts() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.mode == ModeLAN && m.lanIP != "" {
		return []string{m.localHost, "localhost", m.lanIP}
	}
	return []string{m.localHost, "localhost", "127.0.0.1"}
}
