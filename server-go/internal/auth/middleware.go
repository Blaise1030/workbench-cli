package auth

import (
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
)

var sidRE = regexp.MustCompile(`(?:^|;\s*)sid=([^;]+)`)

func parseSID(cookieHeader string) string {
	m := sidRE.FindStringSubmatch(cookieHeader)
	if m == nil {
		return ""
	}
	return m[1]
}

// RequireSession returns middleware that rejects unauthenticated requests.
func RequireSession(session *Session) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sid := parseSID(r.Header.Get("Cookie"))
			if !session.Validate(sid) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireOrigin returns middleware that rejects cross-origin state-changing
// requests. It checks the Origin header on non-safe methods (POST, PUT, PATCH,
// DELETE) and blocks any request whose origin host does not match serverHost.
func RequireOrigin(serverHost string) func(http.Handler) http.Handler {
	safeMethods := map[string]bool{
		http.MethodGet:     true,
		http.MethodHead:    true,
		http.MethodOptions: true,
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if safeMethods[r.Method] {
				next.ServeHTTP(w, r)
				return
			}
			origin := r.Header.Get("Origin")
			if origin == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "Missing Origin header"})
				return
			}
			u, err := url.Parse(origin)
			if err != nil || u.Host != serverHost {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "Forbidden"})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
