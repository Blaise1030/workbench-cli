package keybindings

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
)

func jsonResp(w http.ResponseWriter, v any, code int) {
	w.Header().Set("Content-Type", "application/json")
	if code != http.StatusOK {
		w.WriteHeader(code)
	}
	_ = json.NewEncoder(w).Encode(v)
}

func RegisterRoutes(r chi.Router, session *auth.Session) {
	r.Use(auth.RequireSession(session))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		m, err := Get()
		if err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		jsonResp(w, m, http.StatusOK)
	})

	r.Put("/", func(w http.ResponseWriter, r *http.Request) {
		var m Map
		if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
			jsonResp(w, map[string]string{"error": "Bad request"}, http.StatusBadRequest)
			return
		}
		if err := Put(m); err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		jsonResp(w, m, http.StatusOK)
	})
}
