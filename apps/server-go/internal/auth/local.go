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
