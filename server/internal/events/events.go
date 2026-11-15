// Package events delivers workspace events to the browsers listening on
// /events (Server-Sent Events).
package events

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// Hub fans events out to the subscribers of each workspace.
type Hub struct {
	mu       sync.Mutex
	subs     map[string]map[chan []byte]struct{}
	retained map[string][]byte // last retained message per workspace
}

// NewHub returns an empty hub.
func NewHub() *Hub {
	return &Hub{subs: map[string]map[chan []byte]struct{}{}, retained: map[string][]byte{}}
}

// Subscribe returns the channel of SSE messages for a workspace and a function
// to stop receiving them. The last retained message, if any, comes first.
func (h *Hub) Subscribe(uuid string) (<-chan []byte, func()) {
	ch := make(chan []byte, 16)
	h.mu.Lock()
	if h.subs[uuid] == nil {
		h.subs[uuid] = map[chan []byte]struct{}{}
	}
	h.subs[uuid][ch] = struct{}{}
	if msg := h.retained[uuid]; msg != nil {
		ch <- msg
	}
	h.mu.Unlock()

	return ch, func() {
		h.mu.Lock()
		delete(h.subs[uuid], ch)
		if len(h.subs[uuid]) == 0 {
			delete(h.subs, uuid)
		}
		h.mu.Unlock()
	}
}

// Publish sends an event to every subscriber of a workspace. A subscriber
// that does not keep up loses the event instead of blocking the others.
func (h *Hub) Publish(uuid, typ string, payload any) {
	h.publish(uuid, typ, payload, false)
}

// PublishRetained publishes an event and keeps it for later subscribers of
// the workspace, replacing the previous retained one. Used for progress
// that a page opened later must still see.
func (h *Hub) PublishRetained(uuid, typ string, payload any) {
	h.publish(uuid, typ, payload, true)
}

func (h *Hub) publish(uuid, typ string, payload any, retain bool) {
	msg, err := Message(typ, payload)
	if err != nil {
		slog.Error("encode event", "type", typ, "err", err)
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if retain {
		h.retained[uuid] = msg
	}
	for ch := range h.subs[uuid] {
		select {
		case ch <- msg:
		default:
			slog.Warn("event dropped: slow subscriber", "workspace", uuid, "type", typ)
		}
	}
}

// Message formats an event in the schema the frontend expects:
// event "message", data {type, payload, timestamp}.
func Message(typ string, payload any) ([]byte, error) {
	data, err := json.Marshal(map[string]any{
		"type":      typ,
		"payload":   payload,
		"timestamp": time.Now().UnixMilli(),
	})
	if err != nil {
		return nil, err
	}
	return fmt.Appendf(nil, "event: message\ndata: %s\n\n", data), nil
}
