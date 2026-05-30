package server

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/api"
	"github.com/blaisetiong/workbench-cli/server-go/internal/appstate"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/terminal"
	"github.com/blaisetiong/workbench-cli/server-go/internal/tlsutil"
)

const version = "0.1.1"

// buildAllowedHosts lists Origin header hosts permitted for state-changing API calls.
// WORKBENCH_DEV_UI_PORT adds localhost:<port> when Vite proxies /api during dev:go.
func buildAllowedHosts(port int, host string) []string {
	portStr := fmt.Sprintf("%d", port)
	hosts := []string{
		fmt.Sprintf("localhost:%s", portStr),
		fmt.Sprintf("127.0.0.1:%s", portStr),
	}
	if cfgHost := fmt.Sprintf("%s:%s", host, portStr); cfgHost != hosts[0] && cfgHost != hosts[1] {
		hosts = append(hosts, cfgHost)
	}
	if devPort := strings.TrimSpace(os.Getenv("WORKBENCH_DEV_UI_PORT")); devPort != "" {
		hosts = append(hosts,
			fmt.Sprintf("localhost:%s", devPort),
			fmt.Sprintf("127.0.0.1:%s", devPort),
		)
	}
	return hosts
}

type Config struct {
	Port      int
	Host      string
	ForceHTTP bool
	AssumeYes bool
}

func Run(cfg Config) error {
	state, err := appstate.New(cfg.Port, cfg.Host, cfg.ForceHTTP)
	if err != nil {
		return fmt.Errorf("init state: %w", err)
	}
	defer state.DB.Close()

	ts := settings.GetTerminalSettings(state.SettingsStore)
	registry := terminal.NewRegistry(terminal.RegistryConfig{
		CapBytes: settings.ScrollbackCapBytes(ts.ScrollbackCapKb),
		IdleTTL:  time.Duration(settings.PtyIdleTtlMs(ts.PtyIdleTtlHours)) * time.Millisecond,
	})
	defer registry.Shutdown()

	cookieSecure := !cfg.ForceHTTP
	r := chi.NewRouter()

	openHost := cfg.Host
	if cfg.ForceHTTP {
		openHost = "127.0.0.1"
	}
	allowedHosts := buildAllowedHosts(cfg.Port, cfg.Host)
	api.RegisterRoutes(r, version, state, cookieSecure, registry, allowedHosts)

	listenAddr := fmt.Sprintf("127.0.0.1:%d", cfg.Port)

	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", listenAddr, err)
	}

	scheme := "http"
	if !cfg.ForceHTTP {
		hosts := []string{cfg.Host, "localhost", "127.0.0.1"}
		creds, tlsErr := tlsutil.EnsureTLS(hosts, tlsutil.EnsureOptions{
			AutoInstall: cfg.AssumeYes,
		})
		if tlsErr != nil {
			slog.Warn("TLS setup failed, falling back to HTTP", "err", tlsErr)
			fmt.Printf("\n  ⚠ Serving over HTTP on localhost only (not encrypted).\n  %s\n\n", tlsErr)
		} else {
			scheme = "https"
			ln = tls.NewListener(ln, &tls.Config{
				Certificates: []tls.Certificate{creds.Cert},
			})
		}
	}

	fmt.Printf("\n  → %s://%s:%d\n\n", scheme, openHost, cfg.Port)
	slog.Info("workbench-cli started", "url", fmt.Sprintf("%s://%s:%d", scheme, openHost, cfg.Port))

	srv := &http.Server{
		Addr:    listenAddr,
		Handler: r,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
		}
	}()

	<-quit
	slog.Info("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return srv.Shutdown(ctx)
}
