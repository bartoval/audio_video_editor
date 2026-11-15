package api

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/bartoval/audio_video_editor/server/internal/events"
	"github.com/bartoval/audio_video_editor/server/internal/separation"
)

// startStems queues the separation of a library track. The frontend learns
// the outcome from a "job:completed" event.
func (s *server) startStems(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Stems == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error": map[string]string{"code": "UNAVAILABLE", "message": "stem separation is not configured"},
		})
		return
	}
	jobID, err := s.cfg.Stems.Start(r.PathValue("uuid"), r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"jobId": jobID, "status": "pending"})
}

func (s *server) downloadStems(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Stems == nil {
		writeError(w, separation.ErrNotReady)
		return
	}
	track := separation.TrackName(r.PathValue("id"))
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s_stems.zip"`, track))

	// The zip streams straight to the response. Errors before the first byte
	// still get a JSON body; later ones can only cut the download.
	cw := &countingWriter{w: w}
	err := s.cfg.Stems.WriteZip(cw, r.PathValue("uuid"), r.PathValue("jobId"), track)
	if err != nil && cw.n == 0 {
		w.Header().Del("Content-Disposition")
		writeError(w, err)
	} else if err != nil {
		slog.Warn("stems download interrupted", "err", err)
	}
}

// StemsDone returns the callback that announces the end of a separation job
// to the workspace, with the payload the ML worker callback used to send.
func StemsDone(hub *events.Hub) func(separation.Result) {
	return func(res separation.Result) {
		payload := map[string]any{
			"type": "stems", "jobId": res.JobID, "audioId": res.AudioID,
			"status": "completed", "error": nil, "stems": res.Stems,
		}
		if res.Err != nil {
			payload["status"], payload["error"], payload["stems"] = "failed", res.Err.Error(), nil
		}
		hub.Publish(res.UUID, "job:completed", payload)
	}
}

type countingWriter struct {
	w http.ResponseWriter
	n int64
}

func (c *countingWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	c.n += int64(n)
	return n, err
}
