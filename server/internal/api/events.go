package api

import (
	"encoding/json"
	"log/slog"
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

// jobCallback receives the end of an ML worker job (transcription, scene
// detection) and announces it to the workspace as "job:completed".
func (s *server) jobCallback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var body map[string]any
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxStateSize)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid body"})
		return
	}
	uuid, jobID := q.Get("uuid"), body["job_id"]
	if uuid == "" || jobID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing uuid or job_id"})
		return
	}
	jobType := q.Get("type")
	if jobType == "" {
		jobType = "stems"
	}
	payload := map[string]any{
		"type": jobType, "jobId": jobID, "audioId": q.Get("audioId"),
		"status": body["status"], "error": body["error"],
	}
	var fields []string
	switch jobType {
	case "stems":
		fields = []string{"stems"}
	case "transcribe":
		fields = []string{"text", "segments", "language", "duration"}
	case "scene-detect":
		fields = []string{"scenes", "fps", "duration"}
	}
	for _, f := range fields {
		payload[f] = body[f]
	}
	slog.Info("job callback", "workspace", uuid, "job", jobID, "type", jobType, "status", body["status"])
	s.cfg.Events.Publish(uuid, "job:completed", payload)
	writeJSON(w, http.StatusOK, map[string]bool{"received": true})
}
