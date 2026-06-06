package sidecar

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/coder/websocket"
	"github.com/google/uuid"
)

type hubClient struct {
	send chan []byte
	done chan struct{}
}

// Hub relays messages between the IDE tab and the proxy tab.
// It intercepts element-selected messages to persist screenshots to disk.
type Hub struct {
	mu      sync.RWMutex
	clients map[*hubClient]struct{}
	dataDir string // directory where screenshot files are saved
}

func NewHub(dataDir string) *Hub {
	return &Hub{
		clients: make(map[*hubClient]struct{}),
		dataDir: dataDir,
	}
}

func (h *Hub) add(c *hubClient) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) remove(c *hubClient) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
	close(c.done)
}

func (h *Hub) broadcast(msg []byte, exclude *hubClient) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c == exclude {
			continue
		}
		select {
		case c.send <- msg:
		default:
		}
	}
}

// BroadcastRefresh sends {"type":"refresh"} to all connected clients.
func (h *Hub) BroadcastRefresh() {
	h.broadcast([]byte(`{"type":"refresh"}`), nil)
}

// processIncoming intercepts element-selected messages: saves the base64 screenshot
// to dataDir/files/<uuid>.png and replaces the screenshot field with screenshotPath.
// All other message types are returned unchanged.
func (h *Hub) processIncoming(raw []byte) []byte {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	var msgType string
	if err := json.Unmarshal(m["type"], &msgType); err != nil {
		return raw
	}
	if msgType != "element-selected" {
		return raw
	}

	screenshotRaw, ok := m["screenshot"]
	if !ok {
		return raw
	}
	var b64 string
	if err := json.Unmarshal(screenshotRaw, &b64); err != nil || b64 == "" {
		return raw
	}

	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		slog.Warn("sidecar: invalid screenshot base64", "err", err)
		return raw
	}

	dir := filepath.Join(h.dataDir, "files")
	if err := os.MkdirAll(dir, 0755); err != nil {
		slog.Warn("sidecar: cannot create files dir", "err", err)
		return raw
	}

	fname := fmt.Sprintf("%s.png", uuid.New().String())
	fpath := filepath.Join(dir, fname)
	if err := os.WriteFile(fpath, data, 0644); err != nil {
		slog.Warn("sidecar: cannot write screenshot", "err", err)
		return raw
	}

	delete(m, "screenshot")
	fpathJSON, _ := json.Marshal(fpath)
	m["screenshotPath"] = fpathJSON

	enriched, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return enriched
}

// ServeWS upgrades the request to a WebSocket connection and joins the hub.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		slog.Error("sidecar ws accept", "err", err)
		return
	}

	c := &hubClient{
		send: make(chan []byte, 64),
		done: make(chan struct{}),
	}
	h.add(c)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go func() {
		defer conn.Close(websocket.StatusNormalClosure, "")
		for {
			select {
			case msg := <-c.send:
				if err := conn.Write(ctx, websocket.MessageText, msg); err != nil {
					return
				}
			case <-c.done:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			break
		}
		outgoing := h.processIncoming(msg)
		h.broadcast(outgoing, c)
	}

	h.remove(c)
}
