package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/assets"
)

func RegisterRoutes(r *chi.Mux, version string) {
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", Health(version))
	})

	// Static SPA — must be last
	r.Handle("/*", assets.Handler())
}
