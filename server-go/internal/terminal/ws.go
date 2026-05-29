package terminal

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/coder/websocket"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/workspace"
)

var sidCookieRE = regexp.MustCompile(`(?:^|;\s*)sid=([^;]+)`)

func parseSIDFromCookie(cookie string) string {
	m := sidCookieRE.FindStringSubmatch(cookie)
	if m == nil {
		return ""
	}
	return m[1]
}

// WSHandler returns an http.Handler for /ws upgrades.
func WSHandler(session *auth.Session, db *sql.DB, registry *Registry) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sid := parseSIDFromCookie(r.Header.Get("Cookie"))
		if !session.Validate(sid) {
			if auth.IsLoopbackAddress(auth.ClientAddress(r)) {
				if !session.Active() {
					session.Activate()
				}
			} else {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
		}

		q := r.URL.Query()
		terminalID := strings.TrimSpace(q.Get("terminalId"))
		if terminalID == "" {
			http.Error(w, "terminalId required", http.StatusBadRequest)
			return
		}
		skipReplay := q.Get("skipReplay") == "1" || strings.EqualFold(q.Get("skipReplay"), "true")

		t, wt, err := workspace.GetTerminalWithWorktree(db, terminalID)
		if err != nil || t == nil {
			http.Error(w, "Terminal not found", http.StatusNotFound)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			InsecureSkipVerify: true,
		})
		if err != nil {
			slog.Error("ws accept", "err", err)
			return
		}

		client := &clientConn{
			send: make(chan []byte, 256),
			done: make(chan struct{}),
		}

		registry.Attach(terminalID, client, wt.Path, t.ResumeCommand, t.ResumeTrusted, t.AgentKind, t.AgentSessionID, skipReplay)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Write loop: send PTY output to WebSocket client
		go func() {
			defer conn.Close(websocket.StatusNormalClosure, "")
			for {
				select {
				case data := <-client.send:
					if err := conn.Write(ctx, websocket.MessageText, data); err != nil {
						return
					}
				case <-client.done:
					return
				case <-ctx.Done():
					return
				}
			}
		}()

		// Read loop: receive WebSocket input → PTY
		for {
			_, msg, err := conn.Read(ctx)
			if err != nil {
				break
			}
			registry.HandleMessage(terminalID, client, string(msg))
		}

		registry.Detach(terminalID, client)
	})
}
