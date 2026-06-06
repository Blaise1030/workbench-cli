package sidecar

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all sidecar endpoints under /sidecar.
func RegisterRoutes(r chi.Router, hub *Hub) {
	r.Get("/sidecar/client.js", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(ClientJS)
	})

	r.HandleFunc("/sidecar/ws", hub.ServeWS)

	r.Handle("/sidecar/proxy", NewProxyHandler())
	r.Handle("/sidecar/proxy/*", NewProxyHandler())
}
