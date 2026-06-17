package auth

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func setSessionCookie(w http.ResponseWriter, sid string, secure bool) {
	cookie := &http.Cookie{
		Name:     "sid",
		Value:    sid,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   3600,
		Path:     "/",
	}
	http.SetCookie(w, cookie)
}

func jsonOK(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// RegisterRoutes mounts POST /local on the given router sub-path.
// tokenValidator, if non-nil, is used to validate a one-time invite token for LAN access.
func RegisterRoutes(r chi.Router, session *Session, cookieSecure bool, tokenValidator func(string) bool) {
	r.Post("/local", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Token string `json:"token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body) // best effort

		if body.Token != "" && tokenValidator != nil && tokenValidator(body.Token) {
			// token validated and consumed by validator
		} else if !IsLoopbackAddress(ClientAddress(r)) {
			// without a valid token, only allow pure localhost (loopback)
			jsonErr(w, "Forbidden", http.StatusForbidden)
			return
		}

		if !session.Active() {
			session.Activate()
		}
		setSessionCookie(w, session.SID(), cookieSecure)
		jsonOK(w)
	})
}
