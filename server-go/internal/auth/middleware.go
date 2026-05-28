package auth

import (
	"encoding/json"
	"net/http"
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
