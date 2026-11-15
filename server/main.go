// Command server is the Go backend of the studio.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/bartoval/audio_video_editor/server/internal/api"
	"github.com/bartoval/audio_video_editor/server/internal/events"
	"github.com/bartoval/audio_video_editor/server/internal/export"
	"github.com/bartoval/audio_video_editor/server/internal/library"
	"github.com/bartoval/audio_video_editor/server/internal/media"
	"github.com/bartoval/audio_video_editor/server/internal/separation"
	"github.com/bartoval/audio_video_editor/server/internal/upload"
	"github.com/bartoval/audio_video_editor/server/internal/video"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	// Keep the existing project layout: <ROOT_PATH>/<DATA_DIR>/0/<uuid>.
	root := env("ROOT_PATH", "../studio-api")
	workspaces, err := workspace.New(filepath.Join(root, env("DATA_DIR", "projects"), "0"))
	if err != nil {
		return err
	}
	if err := workspaces.EnsureDefault(); err != nil {
		return err
	}
	uploads, err := upload.NewReceiver(filepath.Join(root, env("TMP_CHUNKS_DIR", ".tmp_chunks")), maxUpload)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	hub := events.NewHub()
	encoder := media.NewEncoder(ctx, os.Getenv("HW_ENCODER"))
	slog.Info("video encoder", "name", encoder.Name())
	lib := library.New(workspaces)
	cfg := api.Config{
		Workspaces: workspaces,
		Library:    lib,
		Uploads:    uploads,
		Events:     hub,
		Export:     export.New(workspaces, lib),
		Video: video.New(ctx, workspaces, encoder,
			func(uuid string, status map[string]any) { hub.PublishRetained(uuid, "thumbnails", status) }),
	}
	openStems, err := stemsModel(ctx)
	if err != nil {
		return err
	}
	if openStems != nil {
		cfg.Stems = separation.New(ctx, openStems, workspaces, lib, api.StemsDone(hub))
	}

	srv := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           api.New(cfg),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	go cleanUploads(ctx, uploads,
		envMinutes("TMP_TTL_MINUTES", 30), envMinutes("TMP_CLEANUP_INTERVAL_MINUTES", 60))

	errc := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr)
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

// maxUpload bounds a single uploaded file.
const maxUpload = 4 << 30

// cleanUploads removes abandoned partial uploads, at start and then every interval.
func cleanUploads(ctx context.Context, uploads *upload.Receiver, ttl, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		uploads.Clean(ttl)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func envMinutes(key string, fallback int) time.Duration {
	n, err := strconv.Atoi(os.Getenv(key))
	if err != nil || n <= 0 {
		n = fallback
	}
	return time.Duration(n) * time.Minute
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
