package api

import (
	"encoding/json"
	"io"
	"net/http"
)

const (
	// maxStateSize bounds the editor state body. Word-level transcriptions
	// make it far larger than the 100 KB the Node API accepted.
	maxStateSize = 32 << 20
	maxTitleBody = 64 << 10
)

func (s *server) listWorkspaces(w http.ResponseWriter, _ *http.Request) {
	list, err := s.cfg.Workspaces.List()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *server) createWorkspace(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title string `json:"title"`
	}
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxTitleBody)).Decode(&body)
	if err != nil || body.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Title is required"})
		return
	}
	ws, err := s.cfg.Workspaces.Create(body.Title)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"success": true, "uuid": ws.UUID, "title": ws.Title})
}

func (s *server) deleteWorkspace(w http.ResponseWriter, r *http.Request) {
	if err := s.cfg.Workspaces.Delete(r.PathValue("uuid")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *server) loadState(w http.ResponseWriter, r *http.Request) {
	state, err := s.cfg.Workspaces.LoadState(r.PathValue("uuid"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeRawJSON(w, http.StatusOK, state)
}

func (s *server) saveState(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxStateSize))
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.cfg.Workspaces.SaveState(r.PathValue("uuid"), body); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
