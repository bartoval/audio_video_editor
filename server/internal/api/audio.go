package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/bartoval/audio_video_editor/server/internal/library"
	"github.com/bartoval/audio_video_editor/server/internal/media"
	"github.com/bartoval/audio_video_editor/server/internal/upload"
)

const (
	maxChunkRequest = 64 << 20
	// Chunks up to this size stay in memory while the form is parsed.
	chunkMemory = 32 << 20
	immutable   = "public, max-age=31536000, immutable"
)

var errFileType = errors.New("invalid file type")

// uploadExts are the extensions accepted in the library. Browsers send
// chunks as application/octet-stream, so the file name is all there is.
var uploadExts = map[string]bool{
	".wav": true, ".mp3": true, ".ogg": true, ".flac": true, ".aac": true, ".m4a": true,
	".mp4": true, ".webm": true, ".mov": true, ".avi": true, ".mkv": true,
}

var audioTypes = map[string]string{
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
	".flac": "audio/flac", ".aac": "audio/aac", ".m4a": "audio/mp4",
}

func (s *server) listAudio(w http.ResponseWriter, r *http.Request) {
	tracks, err := s.cfg.Library.List(r.PathValue("uuid"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tracks)
}

// uploadAudio receives one chunk of an audio file and, with the last one,
// adds the file to the library.
func (s *server) uploadAudio(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxChunkRequest)
	if err := r.ParseMultipartForm(chunkMemory); err != nil {
		writeError(w, fmt.Errorf("%w: %v", upload.ErrInvalid, err))
		return
	}
	defer r.MultipartForm.RemoveAll()

	filename := r.FormValue("flowFilename")
	if !uploadExts[strings.ToLower(filepath.Ext(filename))] {
		writeError(w, fmt.Errorf("%w: %q", errFileType, filepath.Ext(filename)))
		return
	}
	data, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, fmt.Errorf("%w: missing file", upload.ErrInvalid))
		return
	}
	defer data.Close()

	number, _ := strconv.Atoi(r.FormValue("flowChunkNumber"))
	chunkSize, _ := strconv.ParseInt(r.FormValue("flowChunkSize"), 10, 64)
	totalSize, _ := strconv.ParseInt(r.FormValue("flowTotalSize"), 10, 64)
	res, err := s.cfg.Uploads.Add(upload.Chunk{
		ID: r.FormValue("flowIdentifier"), Number: number,
		ChunkSize: chunkSize, TotalSize: totalSize, Data: data,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	if !res.Done {
		writeJSON(w, http.StatusOK, map[string]any{"status": "partly_done", "chunk": number, "total": res.Total})
		return
	}

	imported, err := s.cfg.Library.Import(r.Context(), r.PathValue("uuid"), library.Import{
		Src: res.Path, Filename: filename,
		Provider: r.FormValue("provider"), Source: r.FormValue("source"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	status := "complete"
	if imported.Duplicate {
		status = "duplicate"
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": status, "file": imported.ID, "metadata": imported.Track})
}

func (s *server) deleteAudio(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.cfg.Library.Delete(r.PathValue("uuid"), id); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted", "file": id})
}

func (s *server) getAudio(w http.ResponseWriter, r *http.Request) {
	uuid, id := r.PathValue("uuid"), r.PathValue("id")
	path, err := s.cfg.Library.File(uuid, id)
	if err != nil {
		writeError(w, err)
		return
	}
	serveFile(w, r, path, audioType(path), fmt.Sprintf(`"%s-%s"`, uuid, id), immutable)
}

// getAudioPair serves the two-segment audio routes, which share a pattern:
// derived/{id} and {id}/file. Anything else is not migrated yet.
func (s *server) getAudioPair(w http.ResponseWriter, r *http.Request) {
	a, b := r.PathValue("a"), r.PathValue("b")
	switch {
	case a == "derived":
		s.getDerivedAudio(w, r, b)
	case b == "file":
		s.downloadAudio(w, r, a)
	default:
		s.legacy.ServeHTTP(w, r)
	}
}

func (s *server) getDerivedAudio(w http.ResponseWriter, r *http.Request, id string) {
	uuid := r.PathValue("uuid")
	path, err := s.cfg.Library.Derived(uuid, id)
	if err != nil {
		writeError(w, err)
		return
	}
	serveFile(w, r, path, audioType(path), fmt.Sprintf(`"%s-derived-%s"`, uuid, id), immutable)
}

// downloadAudio serves a track, converted when ?format=mp3|wav is given.
func (s *server) downloadAudio(w http.ResponseWriter, r *http.Request, id string) {
	uuid := r.PathValue("uuid")
	format := r.URL.Query().Get("format")
	if format != "mp3" && format != "wav" {
		path, err := s.cfg.Library.File(uuid, id)
		if err != nil {
			writeError(w, err)
			return
		}
		serveFile(w, r, path, audioType(path), fmt.Sprintf(`"%s-%s"`, uuid, id), immutable)
		return
	}
	path, filename, err := s.cfg.Library.Converted(r.Context(), uuid, id, format)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	serveFile(w, r, path, audioType(path), "", "public, max-age=3600")
}

func (s *server) stretchAudio(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Ratio     flexFloat `json:"ratio"`
		Pitch     flexFloat `json:"pitchValue"`
		StartTime flexFloat `json:"startTime"`
		Duration  flexFloat `json:"duration"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxTitleBody)).Decode(&body); err != nil || body.Ratio == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "audioId and ratio are required"})
		return
	}
	uuid := r.PathValue("uuid")
	outID, cached, err := s.cfg.Library.Stretch(r.Context(), uuid, r.PathValue("id"), media.Stretch{
		Ratio: float64(body.Ratio), Semitones: float64(body.Pitch),
		Start: float64(body.StartTime), Duration: float64(body.Duration),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "complete",
		"outputId": outID,
		"url":      "/api/v1/workspaces/" + uuid + "/audio/derived/" + outID,
		"cached":   cached,
	})
}

// flexFloat accepts a number or a numeric string, like parseFloat in the
// Node API (the frontend sends the ratio as a string).
type flexFloat float64

func (f *flexFloat) UnmarshalJSON(data []byte) error {
	var s string
	if json.Unmarshal(data, &s) == nil {
		v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
		if err != nil {
			return err
		}
		*f = flexFloat(v)
		return nil
	}
	return json.Unmarshal(data, (*float64)(f))
}

func audioType(path string) string {
	if t, ok := audioTypes[strings.ToLower(filepath.Ext(path))]; ok {
		return t
	}
	return "audio/mpeg"
}

// serveFile sends a file with Range and conditional request support.
func serveFile(w http.ResponseWriter, r *http.Request, path, contentType, etag, cacheControl string) {
	f, err := os.Open(path)
	if err != nil {
		writeError(w, err)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		writeError(w, err)
		return
	}
	h := w.Header()
	h.Set("Content-Type", contentType)
	h.Set("Cache-Control", cacheControl)
	if etag != "" {
		h.Set("ETag", etag)
	}
	http.ServeContent(w, r, "", info.ModTime(), f)
}
