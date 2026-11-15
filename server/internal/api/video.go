package api

import (
	"cmp"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/bartoval/audio_video_editor/server/internal/video"
)

const manifestCache = "public, max-age=3600"

// getVideo returns the video metadata and the URLs of its files.
func (s *server) getVideo(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	meta, err := s.cfg.Video.Info(uuid)
	if err != nil {
		writeError(w, err)
		return
	}
	base := "/api/v1/workspaces/" + uuid + "/video"
	writeJSON(w, http.StatusOK, struct {
		video.Metadata
		URLs map[string]string `json:"urls"`
	}{meta, map[string]string{
		"file": base + "/file", "offline": base + "/small", "thumbnails": base + "/thumbnails",
	}})
}

func (s *server) deleteVideo(w http.ResponseWriter, r *http.Request) {
	if err := s.cfg.Video.Delete(r.PathValue("uuid")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// uploadVideo receives one chunk; the complete file becomes the workspace's
// video, converted on POST /video/convert.
func (s *server) uploadVideo(w http.ResponseWriter, r *http.Request) {
	res, ok := s.receiveChunk(w, r)
	if !ok {
		return
	}
	if err := s.cfg.Video.Accept(r.PathValue("uuid"), res.Path); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "complete", "file": "originalWithAudio.mp4"})
}

func (s *server) convertVideo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PriorityScale string `json:"priorityScale"`
	}
	json.NewDecoder(http.MaxBytesReader(w, r.Body, maxTitleBody)).Decode(&body)
	if body.PriorityScale == "" {
		body.PriorityScale = "0.02"
	}
	if err := s.cfg.Video.Convert(r.PathValue("uuid"), body.PriorityScale); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// conversionStatus is polled by the frontend after an upload.
func (s *server) conversionStatus(w http.ResponseWriter, r *http.Request) {
	meta, err := s.cfg.Video.Info(r.PathValue("uuid"))
	if err != nil && !errors.Is(err, video.ErrNotFound) {
		writeError(w, err)
		return
	}
	status := map[string]any{
		"conversionComplete": meta.Status == "ready",
		"thumbnailsComplete": meta.ThumbnailsStatus == "ready",
		"thumbnailsStatus":   cmp.Or(meta.ThumbnailsStatus, "pending"),
		"metadata":           meta,
	}
	if err != nil { // nothing uploaded yet
		status["metadata"] = map[string]any{}
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *server) getVideoFile(w http.ResponseWriter, r *http.Request) {
	path, err := s.cfg.Video.File(r.PathValue("uuid"), false)
	if err != nil {
		writeError(w, err)
		return
	}
	serveFile(w, r, path, "video/mp4", "", "")
}

func (s *server) getSmallVideo(w http.ResponseWriter, r *http.Request) {
	path, err := s.cfg.Video.File(r.PathValue("uuid"), true)
	if err != nil {
		writeError(w, err)
		return
	}
	serveFile(w, r, path, "video/mp4", "", immutable)
}

// getThumb serves the master manifest, a legacy strip (*.webp) or the frame
// at a time in seconds ("12.50"). Thumbnails get no fixed ETag: they are
// regenerated under the same names, and their dates keep revalidation right.
func (s *server) getThumb(w http.ResponseWriter, r *http.Request) {
	uuid, id := r.PathValue("uuid"), r.PathValue("id")
	var path string
	var err error
	contentType, cache := "image/webp", immutable
	switch {
	case id == "manifest.json":
		path, err = s.cfg.Video.Thumb(uuid, "", id)
		contentType, cache = "application/json", manifestCache
	case strings.HasSuffix(id, video.ThumbExt):
		path, err = s.cfg.Video.Thumb(uuid, "", id)
	default:
		path, err = s.cfg.Video.Frame(r.Context(), uuid, id)
		cache = "public, max-age=86400"
	}
	if err != nil {
		writeError(w, err)
		return
	}
	serveFile(w, r, path, contentType, "", cache)
}

// getThumbTile serves a sheet of a scale or the scale's manifest.
func (s *server) getThumbTile(w http.ResponseWriter, r *http.Request) {
	file := r.PathValue("file")
	path, err := s.cfg.Video.Thumb(r.PathValue("uuid"), r.PathValue("scale"), file)
	if err != nil {
		writeError(w, err)
		return
	}
	if file == "manifest.json" {
		serveFile(w, r, path, "application/json", "", manifestCache)
		return
	}
	serveFile(w, r, path, "image/webp", "", immutable)
}
