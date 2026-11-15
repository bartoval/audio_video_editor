package api

import (
	"bufio"
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/url"
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
	legacy := make(chan []byte, 16)
	go relayLegacyEvents(r.Context(), s.cfg.LegacyAPI, uuid, legacy)

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
		case msg = <-legacy:
		case <-heartbeat.C:
			msg = []byte(": heartbeat\n\n")
		}
		if !send(msg) {
			return
		}
	}
}

// relayLegacyEvents forwards the events the Node API still emits (thumbnails,
// ML worker callbacks) until ctx ends, reconnecting when the stream drops.
// Remove it together with the Node API.
func relayLegacyEvents(ctx context.Context, legacy *url.URL, uuid string, out chan<- []byte) {
	streamURL := legacy.JoinPath("api/v1/workspaces", uuid, "events").String()
	for ctx.Err() == nil {
		if err := relayOnce(ctx, streamURL, out); err != nil && ctx.Err() == nil {
			slog.Debug("legacy event stream", "workspace", uuid, "err", err)
		}
		select {
		case <-ctx.Done():
		case <-time.After(2 * time.Second):
		}
	}
}

func relayOnce(ctx context.Context, streamURL string, out chan<- []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, streamURL, nil)
	if err != nil {
		return err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	// SSE messages end with a blank line. Comments (heartbeats) and the
	// legacy "connected" message are dropped: the Go stream sends its own.
	in := bufio.NewReader(res.Body)
	var msg bytes.Buffer
	for {
		line, err := in.ReadBytes('\n')
		if err != nil {
			return err
		}
		if len(bytes.TrimSpace(line)) > 0 {
			if line[0] != ':' {
				msg.Write(line)
			}
			continue
		}
		if msg.Len() > 0 && !bytes.Contains(msg.Bytes(), []byte(`"type":"connected"`)) {
			msg.WriteString("\n")
			select {
			case out <- bytes.Clone(msg.Bytes()):
			case <-ctx.Done():
				return io.EOF
			}
		}
		msg.Reset()
	}
}
