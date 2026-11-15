// Package api implements the studio HTTP API under /api/v1.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/bartoval/audio_video_editor/server/internal/events"
	"github.com/bartoval/audio_video_editor/server/internal/export"
	"github.com/bartoval/audio_video_editor/server/internal/library"
	"github.com/bartoval/audio_video_editor/server/internal/separation"
	"github.com/bartoval/audio_video_editor/server/internal/upload"
	"github.com/bartoval/audio_video_editor/server/internal/video"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

// Config holds what the handlers need.
type Config struct {
	Workspaces *workspace.Store
	Library    *library.Library
	Uploads    *upload.Receiver
	Events     *events.Hub
	Video      *video.Service
	Export     *export.Service
	Stems      *separation.Service // nil when no model is configured
}

type server struct {
	cfg     Config
	started time.Time
}

// New returns the API handler.
func New(cfg Config) http.Handler {
	s := &server{cfg: cfg, started: time.Now()}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/health", s.health)
	mux.HandleFunc("GET /api/v1/config", s.config)

	mux.HandleFunc("GET /api/v1/workspaces", s.listWorkspaces)
	mux.HandleFunc("POST /api/v1/workspaces", s.createWorkspace)
	mux.HandleFunc("DELETE /api/v1/workspaces/{uuid}", s.deleteWorkspace)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/state", s.loadState)
	mux.HandleFunc("PUT /api/v1/workspaces/{uuid}/state", s.saveState)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/events", s.subscribeEvents)

	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/video", s.getVideo)
	mux.HandleFunc("DELETE /api/v1/workspaces/{uuid}/video", s.deleteVideo)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/video/file", s.getVideoFile)
	mux.HandleFunc("POST /api/v1/workspaces/{uuid}/video/file", s.uploadVideo)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/video/small", s.getSmallVideo)
	mux.HandleFunc("POST /api/v1/workspaces/{uuid}/video/convert", s.convertVideo)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/video/convert", s.conversionStatus)
	mux.HandleFunc("POST /api/v1/workspaces/{uuid}/video/scene-detect", s.detectScenes)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/video/thumbnails/{id}", s.getThumb)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/video/thumbnails/{scale}/{file}", s.getThumbTile)

	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/audio", s.listAudio)
	mux.HandleFunc("POST /api/v1/workspaces/{uuid}/audio", s.uploadAudio)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/audio/{id}", s.getAudio)
	mux.HandleFunc("DELETE /api/v1/workspaces/{uuid}/audio/{id}", s.deleteAudio)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/audio/{a}/{b}", s.getAudioPair)
	mux.HandleFunc("POST /api/v1/workspaces/{uuid}/audio/{id}/stretch", s.stretchAudio)
	mux.HandleFunc("POST /api/v1/workspaces/{uuid}/audio/{id}/stems", s.startStems)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/audio/{id}/stems/{jobId}/download", s.downloadStems)

	mux.HandleFunc("POST /api/v1/workspaces/{uuid}/exports", s.exportTimeline)
	mux.HandleFunc("GET /api/v1/workspaces/{uuid}/exports/{file}", s.getExport)

	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		writeError(w, err)
		return
	}
	writeRawJSON(w, status, data)
}

// writeRawJSON writes data that is already valid JSON.
func writeRawJSON(w http.ResponseWriter, status int, data []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if _, err := w.Write(data); err != nil {
		slog.Debug("write response", "err", err)
	}
}

// writeError maps an error to the {"error": {"code", "message"}} response body.
func writeError(w http.ResponseWriter, err error) {
	status, code := http.StatusInternalServerError, "INTERNAL_ERROR"
	var tooLarge *http.MaxBytesError
	switch {
	case errors.Is(err, workspace.ErrNotFound), errors.Is(err, library.ErrNotFound), errors.Is(err, video.ErrNotFound):
		status, code = http.StatusNotFound, "NOT_FOUND"
	case errors.Is(err, workspace.ErrInvalid), errors.Is(err, library.ErrInvalid), errors.Is(err, upload.ErrInvalid),
		errors.Is(err, export.ErrInvalid):
		status, code = http.StatusBadRequest, "VALIDATION_ERROR"
	case errors.Is(err, errFileType):
		status, code = http.StatusBadRequest, "INVALID_FILE_TYPE"
	case errors.Is(err, separation.ErrNotReady):
		status, code = http.StatusBadRequest, "NOT_READY"
	case errors.Is(err, separation.ErrBusy):
		status, code = http.StatusServiceUnavailable, "BUSY"
	case errors.As(err, &tooLarge):
		status, code = http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE"
	}
	if status == http.StatusInternalServerError {
		slog.Error("request failed", "err", err)
	}
	body, _ := json.Marshal(map[string]any{"error": map[string]string{"code": code, "message": err.Error()}})
	writeRawJSON(w, status, body)
}
