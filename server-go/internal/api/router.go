package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/appstate"
	"github.com/blaisetiong/workbench-cli/server-go/internal/assets"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/keybindings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
)

func RegisterRoutes(r *chi.Mux, version string, state *appstate.AppState, cookieSecure bool) {
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", Health(version))

		r.Route("/auth", func(r chi.Router) {
			auth.RegisterRoutes(r, &state.Token, state.Session, state.Lan, cookieSecure)
		})

		r.Route("/settings", func(r chi.Router) {
			settings.RegisterRoutes(r, state.Session, state.SettingsStore, state.Lan, func(enabled bool) error {
				if enabled {
					// Phase 6 will implement real LAN binding
					return nil
				}
				return nil
			})
		})

		r.Route("/keybindings", func(r chi.Router) {
			keybindings.RegisterRoutes(r, state.Session)
		})
	})

	// Static SPA — must be last
	r.Handle("/*", assets.Handler())
}
