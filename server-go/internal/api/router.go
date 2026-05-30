package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/appstate"
	"github.com/blaisetiong/workbench-cli/server-go/internal/assets"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/keybindings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
	"github.com/blaisetiong/workbench-cli/server-go/internal/workspace"
)

func RegisterRoutes(r *chi.Mux, version string, state *appstate.AppState, cookieSecure bool, registry *terminal.Registry, allowedHosts []string) {
	r.Route("/api", func(r chi.Router) {
		r.Use(auth.RequireOrigin(allowedHosts...))
		r.Get("/health", Health(version))

		r.Route("/auth", func(r chi.Router) {
			auth.RegisterRoutes(r, state.Session, cookieSecure)
		})

		r.Route("/settings", func(r chi.Router) {
			settings.RegisterRoutes(r, state.Session, state.SettingsStore, state.Lan)
		})

		r.Route("/keybindings", func(r chi.Router) {
			keybindings.RegisterRoutes(r, state.Session)
		})

		r.Group(func(r chi.Router) {
			workspace.RegisterRoutes(r, state.DB, state.Session)
		})
	})

	r.Handle("/ws", terminal.WSHandler(state.Session, state.DB, registry))
	r.Handle("/*", assets.Handler())
}
