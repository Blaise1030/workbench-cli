package notifications

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
)

func jsonResp(w http.ResponseWriter, v any, code int) {
	w.Header().Set("Content-Type", "application/json")
	if code != http.StatusOK && code != http.StatusCreated {
		w.WriteHeader(code)
	} else if code == http.StatusCreated {
		w.WriteHeader(code)
	}
	_ = json.NewEncoder(w).Encode(v)
}

type createBody struct {
	WorktreeID *string `json:"worktreeId"`
	TerminalID *string `json:"terminalId"`
	Title      string  `json:"title"`
	Subtitle   *string `json:"subtitle"`
	Body       string  `json:"body"`
}

// RegisterRoutes mounts authenticated notification CRUD under /notifications.
func RegisterRoutes(r chi.Router, db *sql.DB, session *auth.Session) {
	r.Use(auth.RequireSession(session))

	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		list, err := List(db)
		if err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		if list == nil {
			list = []Notification{}
		}
		jsonResp(w, map[string]any{"notifications": list}, http.StatusOK)
	})

	r.Post("/", func(w http.ResponseWriter, req *http.Request) {
		handleCreate(w, req, db)
	})

	r.Patch("/{id}/read", func(w http.ResponseWriter, req *http.Request) {
		id := chi.URLParam(req, "id")
		ok, err := MarkRead(db, id)
		if err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		if !ok {
			jsonResp(w, map[string]string{"error": "Not found"}, http.StatusNotFound)
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})

	r.Post("/read-all", func(w http.ResponseWriter, req *http.Request) {
		if err := MarkAllRead(db); err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})

	r.Delete("/{id}", func(w http.ResponseWriter, req *http.Request) {
		id := chi.URLParam(req, "id")
		ok, err := Delete(db, id)
		if err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		if !ok {
			jsonResp(w, map[string]string{"error": "Not found"}, http.StatusNotFound)
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})
}

// RegisterHookRoute allows loopback clients (e.g. Claude hooks) to POST without a session.
// Must be registered before auth.RequireOrigin middleware.
func RegisterHookRoute(r chi.Router, db *sql.DB) {
	r.Post("/notifications/hook", func(w http.ResponseWriter, req *http.Request) {
		if !auth.IsLocalRequest(req) {
			jsonResp(w, map[string]string{"error": "Forbidden"}, http.StatusForbidden)
			return
		}
		handleCreate(w, req, db)
	})
}

func handleCreate(w http.ResponseWriter, req *http.Request, db *sql.DB) {
	var body createBody
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		jsonResp(w, map[string]string{"error": "Bad request"}, http.StatusBadRequest)
		return
	}
	body.Title = strings.TrimSpace(body.Title)
	body.Body = strings.TrimSpace(body.Body)
	if body.Title == "" || body.Body == "" {
		jsonResp(w, map[string]string{"error": "title and body are required"}, http.StatusBadRequest)
		return
	}
	n, err := Create(db, CreateInput{
		WorktreeID: body.WorktreeID,
		TerminalID: body.TerminalID,
		Title:      body.Title,
		Subtitle:   body.Subtitle,
		Body:       body.Body,
	})
	if err != nil {
		jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
		return
	}
	jsonResp(w, map[string]any{"notification": n}, http.StatusCreated)
}
