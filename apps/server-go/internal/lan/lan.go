package lan

import (
	"fmt"
	"sync"
)

// Manager tracks local URL scheme, hostname, and port for settings and TLS.
type Manager struct {
	mu        sync.RWMutex
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
		urlScheme: scheme,
		port:      port,
		localHost: localHost,
	}
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
	return "127.0.0.1"
}

func (m *Manager) GetTLSHosts() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return []string{m.localHost, "localhost", "127.0.0.1"}
}
