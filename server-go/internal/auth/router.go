package auth

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// LanProvider is the minimal interface auth needs from LanManager.
type LanProvider interface {
	GetInvite() *InviteToken
}

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

// RegisterRoutes mounts POST /local and POST / on the given router sub-path.
func RegisterRoutes(r chi.Router, token *SessionToken, session *Session, lan LanProvider, cookieSecure bool) {
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

	r.Post("/", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Token *string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonErr(w, "Bad request", http.StatusBadRequest)
			return
		}
		input := ""
		if body.Token != nil {
			input = *body.Token
		}

		invite := lan.GetInvite()
		if invite != nil && invite.Valid(input) {
			if session.Active() {
				jsonErr(w, "Another session is already active", http.StatusConflict)
				return
			}
			invite.Consume()
			session.Activate()
			setSessionCookie(w, session.SID(), cookieSecure)
			jsonOK(w)
			return
		}

		// Specific invite error messages
		if invite != nil && input == invite.Value {
			invite.mu.Lock()
			used := invite.Used
			expired := !time.Now().Before(invite.ExpiresAt)
			invite.mu.Unlock()
			if used {
				jsonErr(w, "Invite link already used", http.StatusUnauthorized)
				return
			}
			if expired {
				jsonErr(w, "Invite link expired — ask host to regenerate", http.StatusUnauthorized)
				return
			}
		}

		if !token.Valid(input) {
			if token.Expired() {
				jsonErr(w, "Token expired — restart the server", http.StatusUnauthorized)
				return
			}
			jsonErr(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		if session.Active() {
			jsonErr(w, "Another session is already active", http.StatusConflict)
			return
		}

		session.Activate()
		setSessionCookie(w, session.SID(), cookieSecure)
		jsonOK(w)
	})
}
