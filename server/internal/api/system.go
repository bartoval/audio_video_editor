package api

import (
	"net/http"
	"os"
	"time"
)

// thumbScale is a timeline zoom level and the rate at which thumbnails are
// extracted for it.
type thumbScale struct {
	Scale string
	FPS   float64
}

var thumbScales = []thumbScale{
	{"0.01", 2}, {"0.02", 1}, {"0.05", 0.4}, {"0.1", 0.2},
	{"0.2", 0.1}, {"0.5", 0.04}, {"1", 0.02}, {"2", 0.01},
}

const (
	defaultThumbScale = "0.1" // generated first
	thumbTileCols     = 10
	thumbTileRows     = 10
	thumbExt          = ".webp"
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
	scales := make([]scale, len(thumbScales))
	for i, t := range thumbScales {
		scales[i] = scale{t.Scale, t.Scale == defaultThumbScale}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"thumbs": map[string]any{
			"scales":       scales,
			"defaultScale": defaultThumbScale,
			"tiles":        map[string]int{"cols": thumbTileCols, "rows": thumbTileRows},
			"extension":    thumbExt,
		},
	})
}
