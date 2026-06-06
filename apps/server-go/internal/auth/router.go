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
func RegisterRoutes(r chi.Router, session *Session, cookieSecure bool) {
	r.Post("/local", func(w http.ResponseWriter, r *http.Request) {
		if !IsLocalRequest(r) {
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
