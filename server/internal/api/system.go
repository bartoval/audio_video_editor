package api

import (
	"net/http"
	"os"
	"time"

	"github.com/bartoval/audio_video_editor/server/internal/video"
)

// health reports whether the server can reach the project storage.
func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	body := map[string]any{
		"status":    "ok",
		"storage":   "ok",
		"uptime":    time.Since(s.started).Seconds(),
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	status := http.StatusOK
	if _, err := os.Stat(s.cfg.Workspaces.Root()); err != nil {
		body["status"], body["storage"] = "degraded", "unavailable"
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, body)
}

// config returns the thumbnail settings the frontend needs to request tiles.
func (s *server) config(w http.ResponseWriter, _ *http.Request) {
	type scale struct {
		Scale      string `json:"scale"`
		IsPriority bool   `json:"isPriority"`
	}
	scales := make([]scale, len(video.Scales))
	for i, t := range video.Scales {
		scales[i] = scale{t.Name, t.Name == video.DefaultScale}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"thumbs": map[string]any{
			"scales":       scales,
			"defaultScale": video.DefaultScale,
			"tiles":        map[string]int{"cols": video.TileCols, "rows": video.TileRows},
			"extension":    video.ThumbExt,
		},
	})
}
