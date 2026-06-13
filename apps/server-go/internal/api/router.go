package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/blaisetiong/workbench-cli/server-go/internal/appstate"
	"github.com/blaisetiong/workbench-cli/server-go/internal/assets"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
	"github.com/blaisetiong/workbench-cli/server-go/internal/keybindings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/notifications"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
	"github.com/blaisetiong/workbench-cli/server-go/internal/workspace"
	"github.com/go-chi/chi/v5"
)

func publishEvent(bus *events.Bus, topics ...string) {
	if bus == nil {
		return
	}
	bus.Publish(topics...)
}

// parseWorktreeInterest turns the ?worktree= query value (comma-separated worktree
// ids) into an interest set. Empty input yields a nil set: the connection then
// receives only global topics (sessions / worktrees), never another worktree's
// git-status / file-tree churn.
func parseWorktreeInterest(raw string) map[string]bool {
	if raw == "" {
		return nil
	}
	interest := map[string]bool{}
	for _, id := range strings.Split(raw, ",") {
		if id = strings.TrimSpace(id); id != "" {
			interest[id] = true
		}
	}
	return interest
}

func writeJSON(w http.ResponseWriter, v any, code int) {
	w.Header().Set("Content-Type", "application/json")
	if code != http.StatusOK {
		w.WriteHeader(code)
	}
	_ = json.NewEncoder(w).Encode(v)
}

func RegisterRoutes(r *chi.Mux, version string, state *appstate.AppState, cookieSecure bool, registry *terminal.Registry, allowedHosts []string) {
	r.Route("/api", func(r chi.Router) {
		// Public loopback hook (e.g. Claude hooks) — must bypass the origin guard.
		notifications.RegisterHookRoute(r, state.DB, state.EventBus)

		// Loopback-only agent registration (called by workbench-cli register hook).
		r.Post("/register", func(w http.ResponseWriter, req *http.Request) {
			if !auth.IsLocalRequest(req) {
				writeJSON(w, map[string]string{"error": "Forbidden"}, http.StatusForbidden)
				return
			}
			var body struct {
				TerminalID string `json:"terminalId"`
				Source     string `json:"source"`
				SessionID  string `json:"sessionId"`
				State      string `json:"state"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, map[string]string{"error": "Bad request"}, http.StatusBadRequest)
				return
			}
			body.TerminalID = strings.TrimSpace(body.TerminalID)
			body.Source = strings.TrimSpace(body.Source)
			if body.TerminalID == "" || body.Source == "" {
				writeJSON(w, map[string]string{"error": "terminalId and source are required"}, http.StatusBadRequest)
				return
			}
			if err := workspace.UpdateTerminalAgentSession(state.DB, body.TerminalID, body.Source, body.SessionID); err != nil {
				writeJSON(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
				return
			}
			if body.State != "" {
				registry.SetAgentStatus(body.TerminalID, body.State)
			}
			writeJSON(w, map[string]bool{"ok": true}, http.StatusOK)
			publishEvent(state.EventBus, "sessions")
		})

		// Loopback-only agent status update (called by wterm status hook).
		r.Post("/agent-status", func(w http.ResponseWriter, req *http.Request) {
			if !auth.IsLocalRequest(req) {
				writeJSON(w, map[string]string{"error": "Forbidden"}, http.StatusForbidden)
				return
			}
			var body struct {
				TerminalID string `json:"terminalId"`
				State      string `json:"state"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, map[string]string{"error": "Bad request"}, http.StatusBadRequest)
				return
			}
			body.TerminalID = strings.TrimSpace(body.TerminalID)
			body.State = strings.TrimSpace(body.State)
			if body.TerminalID == "" || body.State == "" {
				writeJSON(w, map[string]string{"error": "terminalId and state are required"}, http.StatusBadRequest)
				return
			}
			registry.SetAgentStatus(body.TerminalID, body.State)
			writeJSON(w, map[string]bool{"ok": true}, http.StatusOK)
			publishEvent(state.EventBus, "sessions")
		})

		// Origin-guarded routes live in their own group so the middleware is
		// declared before any route on that (inline) mux.
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireOrigin(allowedHosts...))
			r.Get("/health", Health(version))

			r.With(auth.RequireSession(state.Session)).Get("/events", func(w http.ResponseWriter, req *http.Request) {
				flusher, ok := w.(http.Flusher)
				if !ok {
					http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
					return
				}
				w.Header().Set("Content-Type", "text/event-stream")
				w.Header().Set("Cache-Control", "no-cache")
				w.Header().Set("Connection", "keep-alive")
				w.Header().Set("X-Accel-Buffering", "no")

				sub := state.EventBus.Subscribe(parseWorktreeInterest(req.URL.Query().Get("worktree")))
				defer state.EventBus.Unsubscribe(sub)

				// Send a real data event so clients can confirm the connection is live.
				fmt.Fprint(w, "data: {\"topics\":[]}\n\n")
				flusher.Flush()

				ticker := time.NewTicker(30 * time.Second)
				defer ticker.Stop()

				for {
					select {
					case <-req.Context().Done():
						return
					case msg, ok := <-sub.C:
						if !ok {
							return
						}
						fmt.Fprintf(w, "data: %s\n\n", msg)
						flusher.Flush()
					case <-ticker.C:
						fmt.Fprint(w, ": heartbeat\n\n")
						flusher.Flush()
					}
				}
			})

			r.Route("/auth", func(r chi.Router) {
				auth.RegisterRoutes(r, state.Session, cookieSecure)
			})

			r.Route("/settings", func(r chi.Router) {
				settings.RegisterRoutes(r, state.Session, state.SettingsStore, state.Lan)
			})

			r.Route("/keybindings", func(r chi.Router) {
				keybindings.RegisterRoutes(r, state.Session)
			})

			r.Route("/notifications", func(r chi.Router) {
				notifications.RegisterRoutes(r, state.DB, state.Session, state.EventBus)
			})

			r.Get("/sessions", func(w http.ResponseWriter, req *http.Request) {
				terminals, err := workspace.ListAgentTerminals(state.DB)
				if err != nil {
					writeJSON(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
					return
				}
				type sessionResp struct {
					workspace.AgentTerminal
					AgentStatus string `json:"agentStatus"`
					IsAlive     bool   `json:"isAlive"`
				}
				sessions := make([]sessionResp, 0, len(terminals))
				for _, t := range terminals {
					status, alive := registry.GetAgentStatus(t.ID)
					sessions = append(sessions, sessionResp{t, status, alive})
				}
				writeJSON(w, map[string]any{"sessions": sessions}, http.StatusOK)
			})

			// Clear an agent's needs_attention status when the user opens the
			// terminal. Compare-and-set so a concurrent running/idle update is
			// not clobbered. Sits alongside GET /sessions (origin-guarded).
			r.Post("/sessions/{terminalId}/ack", func(w http.ResponseWriter, req *http.Request) {
				terminalID := strings.TrimSpace(chi.URLParam(req, "terminalId"))
				if terminalID == "" {
					writeJSON(w, map[string]string{"error": "terminalId is required"}, http.StatusBadRequest)
					return
				}
				changed := registry.SetAgentStatusIf(terminalID, "needs_attention", "idle")
				if changed {
					publishEvent(state.EventBus, "sessions")
				}
				writeJSON(w, map[string]bool{"ok": true, "changed": changed}, http.StatusOK)
			})

			r.Group(func(r chi.Router) {
				workspace.RegisterRoutes(r, state.DB, state.Session, state.EventBus, state.WorktreeWatcher, registry)
			})
		})
	})

	r.Handle("/ws", terminal.WSHandler(state.Session, state.DB, registry))
	r.Handle("/*", assets.Handler())
}
