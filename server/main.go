// Command server is the Go backend of the studio. Routes not yet migrated
// are forwarded to the legacy Node API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/bartoval/audio_video_editor/server/internal/api"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	legacy, err := url.Parse(env("LEGACY_API_URL", "http://localhost:8090"))
	if err != nil {
		return err
	}

	// Same layout as the Node API: <ROOT_PATH>/<DATA_DIR>/0/<uuid>.
	root := env("ROOT_PATH", "../studio-api")
	workspaces, err := workspace.New(filepath.Join(root, env("DATA_DIR", "projects"), "0"))
	if err != nil {
		return err
	}
	if err := workspaces.EnsureDefault(); err != nil {
		return err
	}
	cfg := api.Config{Workspaces: workspaces, LegacyAPI: legacy}

	srv := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           api.New(cfg),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr, "legacy", legacy.String())
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}

	// SSE streams never end on their own: give requests a few seconds, then cut them.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	return srv.Close()
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
