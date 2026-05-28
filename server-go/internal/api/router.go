package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/appstate"
	"github.com/blaisetiong/workbench-cli/server-go/internal/assets"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
)

func RegisterRoutes(r *chi.Mux, version string, state *appstate.AppState, cookieSecure bool) {
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", Health(version))
		r.Route("/auth", func(r chi.Router) {
			auth.RegisterRoutes(r, &state.Token, state.Session, state.Lan, cookieSecure)
		})
	})

	// Static SPA — must be last
	r.Handle("/*", assets.Handler())
}
