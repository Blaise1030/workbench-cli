package lan

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"sync"
	"time"
)

// Manager tracks local URL scheme, hostname, and port for settings and TLS.
// When lanMode is true the server listens on 0.0.0.0 and advertises LAN IPs.
type Manager struct {
	mu        sync.RWMutex
	urlScheme string
	port      int
	localHost string
	lan       bool
	lanIPs    []string

	// invite token state (rotates every 30s, single-use after consumption)
	inviteMu        sync.Mutex
	currentInvite   string
	inviteExpiresAt time.Time
}

// getPrivateIPv4 discovers usable private LAN IPv4 addresses (excludes loopback, link-local).
func getPrivateIPv4() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&(net.FlagLoopback|net.FlagPointToPoint) != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipnet.IP.To4()
			if ip == nil {
				continue
			}
			if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
				continue
			}
			// RFC1918 private ranges
			if ip[0] == 10 || (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] == 192 && ip[1] == 168) {
				ips = append(ips, ip.String())
			}
		}
	}
	return ips
}

func New(port int, localHost string, forceHTTP bool, lan bool) *Manager {
	scheme := "https"
	if forceHTTP {
		scheme = "http"
	}
	m := &Manager{
		urlScheme: scheme,
		port:      port,
		localHost: localHost,
		lan:       lan,
		lanIPs:    getPrivateIPv4(),
	}
	m.rotateInviteToken()
	go m.runInviteRotation()
	return m
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
	hosts := []string{m.localHost, "localhost", "127.0.0.1"}
	if m.lan {
		for _, ip := range m.lanIPs {
			hosts = append(hosts, ip)
		}
	}
	return hosts
}

// IsLANMode reports whether the server is bound for LAN access.
func (m *Manager) IsLANMode() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lan
}

// GetLANIPs returns discovered private LAN IPv4 addresses (may be empty).
func (m *Manager) GetLANIPs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]string, len(m.lanIPs))
	copy(out, m.lanIPs)
	return out
}

// GetLANURLs returns full http(s) URLs using the discovered LAN IPs.
func (m *Manager) GetLANURLs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	urls := make([]string, len(m.lanIPs))
	for i, ip := range m.lanIPs {
		urls[i] = fmt.Sprintf("%s://%s:%d/", m.urlScheme, ip, m.port)
	}
	return urls
}

// --- Invite token (rotating every 30s, single-use) ---

func generateSecureToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// extremely rare fallback
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func (m *Manager) runInviteRotation() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		m.rotateInviteToken()
	}
}

func (m *Manager) rotateInviteToken() {
	token := generateSecureToken()
	m.inviteMu.Lock()
	m.currentInvite = token
	m.inviteExpiresAt = time.Now().Add(30 * time.Second)
	m.inviteMu.Unlock()
}

// GetCurrentInviteToken returns the currently active invite token if still valid.
// The token is only valid for a short window and is single-use.
func (m *Manager) GetCurrentInviteToken() string {
	m.inviteMu.Lock()
	defer m.inviteMu.Unlock()
	if m.currentInvite == "" || m.inviteExpiresAt.IsZero() || time.Now().After(m.inviteExpiresAt) {
		return ""
	}
	return m.currentInvite
}

// GetInviteURL returns a ready-to-use URL containing the current invite token
// (appended as ?invite=TOKEN). It prefers a discovered LAN IP when available.
func (m *Manager) GetInviteURL() string {
	token := m.GetCurrentInviteToken()
	if token == "" {
		return ""
	}

	m.mu.RLock()
	scheme := m.urlScheme
	port := m.port
	host := m.localHost
	ips := append([]string(nil), m.lanIPs...)
	m.mu.RUnlock()

	if len(ips) > 0 {
		host = ips[0]
	}
	return fmt.Sprintf("%s://%s:%d/?invite=%s", scheme, host, port, token)
}

// ValidateAndConsumeInviteToken checks the provided token against the current active one.
// If it matches and has not expired, the token is immediately invalidated (single-use)
// and true is returned.
func (m *Manager) ValidateAndConsumeInviteToken(token string) bool {
	if token == "" {
		return false
	}
	m.inviteMu.Lock()
	defer m.inviteMu.Unlock()

	if m.currentInvite == "" || token != m.currentInvite {
		return false
	}
	if m.inviteExpiresAt.IsZero() || time.Now().After(m.inviteExpiresAt) {
		m.currentInvite = ""
		m.inviteExpiresAt = time.Time{}
		return false
	}

	// valid and within window — consume it
	m.currentInvite = ""
	m.inviteExpiresAt = time.Time{}
	return true
}
