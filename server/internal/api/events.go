package api

import (
	"net/http"
	"time"

	"github.com/bartoval/audio_video_editor/server/internal/events"
)

const heartbeatInterval = 30 * time.Second

// subscribeEvents streams the events of a workspace (Server-Sent Events).
func (s *server) subscribeEvents(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Accel-Buffering", "no") // nginx must not buffer the stream
	// In development the frontend opens this stream on another origin.
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")

	local, unsubscribe := s.cfg.Events.Subscribe(uuid)
	defer unsubscribe()

	rc := http.NewResponseController(w)
	send := func(msg []byte) bool {
		if _, err := w.Write(msg); err != nil {
			return false
		}
		return rc.Flush() == nil
	}
	hello, _ := events.Message("connected", map[string]string{"uuid": uuid})
	if !send(hello) {
		return
	}

	heartbeat := time.NewTicker(heartbeatInterval)
	defer heartbeat.Stop()
	for {
		var msg []byte
		select {
		case <-r.Context().Done():
			return
		case msg = <-local:
		case <-heartbeat.C:
			msg = []byte(": heartbeat\n\n")
		}
		if !send(msg) {
			return
		}
	}
}
