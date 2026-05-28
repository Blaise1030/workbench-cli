package server

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/api"
	"github.com/blaisetiong/workbench-cli/server-go/internal/appstate"
)

const version = "0.1.0"

type Config struct {
	Port      int
	Host      string
	ForceHTTP bool
	AssumeYes bool
}

func Run(cfg Config) error {
	state := appstate.New(cfg.Port, cfg.Host, cfg.ForceHTTP)
	cookieSecure := !cfg.ForceHTTP

	r := chi.NewRouter()
	api.RegisterRoutes(r, version, state, cookieSecure)

	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	listenAddr := addr
	if cfg.ForceHTTP {
		listenAddr = fmt.Sprintf("127.0.0.1:%d", cfg.Port)
		srv.Addr = listenAddr
	}

	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", listenAddr, err)
	}

	scheme := "https"
	if cfg.ForceHTTP {
		scheme = "http"
	}
	slog.Info("workbench-cli started", "url", fmt.Sprintf("%s://%s:%d", scheme, cfg.Host, cfg.Port))

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
