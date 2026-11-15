package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/bartoval/audio_video_editor/server/internal/export"
)

// exportTimeline renders the timeline and returns the URL of the result.
func (s *server) exportTimeline(w http.ResponseWriter, r *http.Request) {
	var req export.Request
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxStateSize)).Decode(&req); err != nil {
		writeError(w, fmt.Errorf("%w: %v", export.ErrInvalid, err))
		return
	}
	res, err := s.cfg.Export.Export(r.Context(), r.PathValue("uuid"), req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// getExport serves a published file: "out" (video), "audio.mp3" or "audio.wav".
func (s *server) getExport(w http.ResponseWriter, r *http.Request) {
	path, contentType, err := s.cfg.Export.File(r.PathValue("uuid"), r.PathValue("file"))
	if err != nil {
		writeError(w, err)
		return
	}
	serveFile(w, r, path, contentType, "", "")
}
