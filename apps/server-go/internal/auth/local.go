package auth

import (
	"net"
	"net/http"
	"strings"
)

func IsLoopbackAddress(addr string) bool {
	if addr == "" {
		return false
	}
	if addr == "127.0.0.1" || addr == "::1" || addr == "::ffff:127.0.0.1" {
		return true
	}
	if strings.HasPrefix(addr, "127.") {
		return true
	}
	ip := net.ParseIP(addr)
	return ip != nil && ip.IsLoopback()
}

func ClientAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func IsLocalRequest(r *http.Request) bool {
	return IsLoopbackAddress(ClientAddress(r))
}

// IsPrivateLANAddress reports whether addr is an RFC1918 private IPv4 or IPv6 ULA address.
func IsPrivateLANAddress(addr string) bool {
	ip := net.ParseIP(addr)
	if ip == nil {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		return ip4[0] == 10 || (ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31) || (ip4[0] == 192 && ip4[1] == 168)
	}
	// IPv6 unique local (fc00::/7)
	return len(ip) == 16 && (ip[0] == 0xfc || ip[0] == 0xfd)
}

// CanBootstrapSession returns true for loopback or private LAN addresses.
// Used only for initial session cookie bootstrap (/auth/local) to support LAN mode
// while keeping strict localhost for dangerous actions (folder picker etc.).
func CanBootstrapSession(r *http.Request) bool {
	addr := ClientAddress(r)
	if IsLoopbackAddress(addr) {
		return true
	}
	return IsPrivateLANAddress(addr)
}
