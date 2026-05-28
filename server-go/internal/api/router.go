package api

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r *chi.Mux, version string) {
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", Health(version))
	})
}
