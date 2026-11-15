// Package video manages the video of a workspace:
//
//	<workspace>/originalWithAudio.mp4          unmodified original, retained after conversion
//	<workspace>/info.json                      metadata and conversion status
//	<workspace>/video.mp4                      muted, browser-ready copy
//	<workspace>/resources/videoTracks/small.mp4  low resolution copy for offline use
//	<workspace>/thumbs/manifest.json           thumbnail sheets, one folder per scale
//	<workspace>/thumbs/cache/                  single frames
package video

import (
	"cmp"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/bartoval/audio_video_editor/server/internal/files"
	"github.com/bartoval/audio_video_editor/server/internal/media"
	"github.com/bartoval/audio_video_editor/server/internal/scenes"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

// ErrNotFound is returned when the workspace has no such video file.
var ErrNotFound = errors.New("video not found")

// Scale is a timeline zoom level and the rate at which thumbnails are taken for it.
type Scale struct {
	Name string
	FPS  float64
}

// Thumbnail settings shared with the frontend through /config.
var Scales = []Scale{
	{"0.01", 2}, {"0.02", 1}, {"0.05", 0.4}, {"0.1", 0.2},
	{"0.2", 0.1}, {"0.5", 0.04}, {"1", 0.02}, {"2", 0.01},
}

const (
	DefaultScale = "0.1"
	TileCols     = 10
	TileRows     = 10
	ThumbExt     = ".webp"

	thumbHeight = 80
	thumbWebP   = 80  // WebP quality
	smallHeight = 156 // H.264 4:2:0 needs an even height
	frameHeight = 180
)

const (
	originalFile = "originalWithAudio.mp4"
	infoFile     = "info.json"
	videoFile    = "video.mp4"
	smallFile    = "resources/videoTracks/small.mp4"
	thumbsDir    = "thumbs"
)

// Metadata is info.json's "metadata".
type Metadata struct {
	Status             string  `json:"status"` // pending, ready, error
	ID                 string  `json:"id,omitempty"`
	Name               string  `json:"name,omitempty"`
	Duration           float64 `json:"duration,omitempty"` // milliseconds
	DurationFormatted  string  `json:"durationFormatted,omitempty"`
	DisplayAspectRatio string  `json:"displayAspectRatio,omitempty"`
	IsMuteVideo        bool    `json:"isMuteVideo,omitempty"`
	ThumbnailsStatus   string  `json:"thumbnailsStatus,omitempty"` // processing, ready, error
}

// Service converts uploaded videos and serves their files.
type Service struct {
	ws      *workspace.Store
	encoder media.Encoder
	ctx     context.Context // lifetime of background work
	// notify reports thumbnail progress with the payload of the "thumbnails" event.
	notify func(uuid string, payload map[string]any)

	mu sync.Mutex // serializes info.json updates
}

// New returns the video service. Background work stops when ctx ends.
func New(ctx context.Context, ws *workspace.Store, encoder media.Encoder, notify func(string, map[string]any)) *Service {
	return &Service{ws: ws, encoder: encoder, ctx: ctx, notify: notify}
}

// Accept stores an uploaded video as the workspace's original, to be converted.
func (s *Service) Accept(uuid, src string) error {
	defer os.Remove(src) // no-op once moved
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return err
	}
	if err := s.writeInfo(dir, Metadata{Status: "pending"}); err != nil {
		return err
	}
	return files.Move(src, filepath.Join(dir, originalFile))
}

// AcceptLocal keeps a browser-readable original without conversion or quality loss.
func (s *Service) AcceptLocal(ctx context.Context, uuid, src, name string) error {
	defer os.Remove(src)
	info, err := media.ProbeVideo(ctx, src)
	if err != nil {
		return err
	}
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	original := filepath.Join(dir, originalFile)
	if err := files.Move(src, original); err != nil {
		return err
	}
	// Both names refer to the same bytes, without a second copy on disk.
	os.Remove(filepath.Join(dir, videoFile))
	if err := os.Link(original, filepath.Join(dir, videoFile)); err != nil {
		return err
	}
	return files.WriteJSON(filepath.Join(dir, infoFile), map[string]any{"metadata": Metadata{Status: "ready", ID: originalFile, Name: name,
		Duration: info.Duration * 1000, DisplayAspectRatio: info.AspectRatio, IsMuteVideo: true}})
}

// Convert starts converting the uploaded video in the background. Thumbnails
// for priorityScale are announced first.
func (s *Service) Convert(uuid, priorityScale string) error {
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return err
	}
	if !isFile(filepath.Join(dir, originalFile)) {
		return fmt.Errorf("%w: nothing uploaded", ErrNotFound)
	}
	go func() {
		if err := s.convert(uuid, dir, priorityScale); err != nil {
			slog.Error("video conversion failed", "workspace", uuid, "err", err)
			s.updateInfo(dir, func(m *Metadata) { m.Status = "error" })
		}
	}()
	return nil
}

func (s *Service) convert(uuid, dir, priorityScale string) error {
	original := filepath.Join(dir, originalFile)
	info, err := media.ProbeVideo(s.ctx, original)
	if err != nil {
		return err
	}
	meta := Metadata{
		Status: "pending", ID: originalFile, Name: cmp.Or(info.Title, originalFile),
		Duration: info.Duration * 1000, DurationFormatted: media.FormatDuration(info.Duration),
		DisplayAspectRatio: info.AspectRatio, IsMuteVideo: true, ThumbnailsStatus: "processing",
	}
	if err := s.writeInfo(dir, meta); err != nil {
		return err
	}
	thumbs := filepath.Join(dir, thumbsDir)
	if err := os.RemoveAll(thumbs); err != nil {
		return err
	}
	if err := os.MkdirAll(thumbs, 0o755); err != nil {
		return err
	}
	placeholder := map[string]any{
		"status": "processing", "mode": "tiles", "scalesReady": []string{},
		"thumbWidth": nil, "thumbHeight": nil, "scales": map[string]any{},
	}
	if err := files.WriteJSON(filepath.Join(thumbs, "manifest.json"), placeholder); err != nil {
		return err
	}

	// A web codec is copied at once and the video plays while the rest is
	// made; otherwise the re-encoding shares the decoding with the rest.
	copied := media.CanCopy(info)
	if copied {
		if err := media.CopyMuted(s.ctx, original, filepath.Join(dir, videoFile), info); err != nil {
			return err
		}
		meta.Status = "ready"
		if err := s.writeInfo(dir, meta); err != nil {
			return err
		}
		slog.Info("video ready, thumbnails in background", "workspace", uuid)
	}

	scales := slices.Clone(Scales)
	if i := slices.IndexFunc(scales, func(sc Scale) bool { return sc.Name == priorityScale }); i > 0 {
		priority := scales[i]
		scales = append([]Scale{priority}, slices.Delete(scales, i, i+1)...)
	}
	plan := media.Plan{
		Encoder: s.encoder, Small: filepath.Join(dir, smallFile), SmallHeight: smallHeight,
		TileHeight: thumbHeight, Cols: TileCols, Rows: TileRows, Quality: thumbWebP,
		Progress: s.thumbnailProgress(uuid, scales[0].Name, info.Duration),
	}
	if !copied {
		plan.Muted = filepath.Join(dir, videoFile)
	}
	for _, sc := range scales {
		plan.Tiles = append(plan.Tiles, media.TileSet{Dir: filepath.Join(thumbs, sc.Name), FPS: sc.FPS})
	}
	if err := os.MkdirAll(filepath.Dir(plan.Small), 0o755); err != nil {
		return err
	}
	err = media.Process(s.ctx, original, plan)
	if err == nil && !copied {
		meta.Status = "ready"
		err = s.writeInfo(dir, meta)
	}
	if err == nil {
		err = s.writeManifests(uuid, thumbs, scales, info)
	}

	status, event := "ready", map[string]any{"status": "complete", "progress": nil}
	if err != nil {
		slog.Error("thumbnails failed", "workspace", uuid, "err", err)
		status, event = "error", map[string]any{"status": "error", "progress": nil, "error": err.Error()}
	}
	if s.updateInfo(dir, func(m *Metadata) { m.ThumbnailsStatus = status }) {
		s.notify(uuid, event)
	}
	if err != nil && !copied {
		return err // the video itself is missing
	}
	return nil
}

// thumbnailProgress returns the Progress callback that reports, at each new
// percent, how far the thumbnails of the priority scale are.
func (s *Service) thumbnailProgress(uuid, scale string, duration float64) func(float64) {
	last := -1
	return func(t float64) {
		if duration <= 0 {
			return
		}
		percent := min(99, int(100*t/duration))
		if percent != last {
			last = percent
			s.notify(uuid, map[string]any{"status": "generating",
				"progress": map[string]any{"percent": percent, "scale": scale, "isChunkReady": false}})
		}
	}
}

// writeManifests describes each scale's sheets and adds it to the master
// manifest, announcing it as soon as it is listed.
func (s *Service) writeManifests(uuid, thumbs string, scales []Scale, info media.VideoInfo) error {
	thumbWidth := int(math.Round(thumbHeight * float64(info.Width) / float64(info.Height)))
	ready := map[string]any{}
	var names []string
	for _, sc := range scales {
		tiles, err := tileFiles(filepath.Join(thumbs, sc.Name))
		if err != nil {
			return err
		}
		manifest := map[string]any{
			"scale": sc.Name, "fps": sc.FPS, "interval": 1 / sc.FPS, "duration": info.Duration,
			"totalThumbs": int(math.Ceil(info.Duration * sc.FPS)), "thumbWidth": thumbWidth,
			"thumbHeight": thumbHeight, "cols": TileCols, "rows": TileRows,
			"thumbsPerTile": TileCols * TileRows, "tiles": tiles,
		}
		if err := files.WriteJSON(filepath.Join(thumbs, sc.Name, "manifest.json"), manifest); err != nil {
			return err
		}
		ready[sc.Name] = manifest
		names = append(names, sc.Name)
		master := map[string]any{
			"mode": "tiles", "thumbWidth": thumbWidth, "thumbHeight": thumbHeight,
			"scales": ready, "scalesReady": names,
		}
		if err := files.WriteJSON(filepath.Join(thumbs, "manifest.json"), master); err != nil {
			return err
		}
		s.notify(uuid, map[string]any{"status": "scale_complete", "progress": map[string]any{"scale": sc.Name}})
	}
	return nil
}

// tileFiles lists tile_0.webp, tile_1.webp, ... in order.
func tileFiles(dir string) ([]string, error) {
	var tiles []string
	for i := 0; ; i++ {
		name := fmt.Sprintf("tile_%d%s", i, ThumbExt)
		if !isFile(filepath.Join(dir, name)) {
			return tiles, nil
		}
		tiles = append(tiles, name)
	}
}

// Info returns the metadata of the workspace's video; ErrNotFound if none.
func (s *Service) Info(uuid string) (Metadata, error) {
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return Metadata{}, err
	}
	var info struct{ Metadata *Metadata }
	err = files.ReadJSON(filepath.Join(dir, infoFile), &info)
	if errors.Is(err, fs.ErrNotExist) || (err == nil && info.Metadata == nil) {
		return Metadata{}, ErrNotFound
	}
	if err != nil {
		return Metadata{}, err
	}
	return *info.Metadata, nil
}

// Delete removes the video and everything derived from it.
func (s *Service) Delete(uuid string) error {
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return err
	}
	for _, name := range []string{"resources", thumbsDir, originalFile, infoFile, videoFile} {
		if err := os.RemoveAll(filepath.Join(dir, name)); err != nil {
			return err
		}
	}
	return nil
}

// File returns the path of the muted video or, with small set, its low
// resolution copy.
func (s *Service) File(uuid string, small bool) (string, error) {
	name := videoFile
	if small {
		name = smallFile
	}
	return s.existing(uuid, name)
}

// Original returns the unmodified uploaded video.
func (s *Service) Original(uuid string) (string, error) { return s.existing(uuid, originalFile) }

// Thumb returns a file under thumbs/: the master manifest, a legacy strip,
// or, with a scale, one of its sheets or its manifest.
func (s *Service) Thumb(uuid, scale, name string) (string, error) {
	for _, part := range []string{scale, name} {
		if part == "." || part == ".." || strings.ContainsAny(part, `/\`) {
			return "", ErrNotFound
		}
	}
	return s.existing(uuid, filepath.Join(thumbsDir, scale, name))
}

// DetectScenes finds the cuts of the workspace video in the background and
// passes them to done with the job id it returns.
func (s *Service) DetectScenes(uuid string, threshold, minSceneLen float64, done func(jobID string, res scenes.Result, err error)) (string, error) {
	video, err := s.File(uuid, false)
	if err != nil {
		return "", err
	}
	id := make([]byte, 16)
	rand.Read(id)
	jobID := hex.EncodeToString(id)
	go func() {
		res, err := scenes.Detect(s.ctx, video, threshold, minSceneLen)
		if err != nil {
			slog.Error("scene detection failed", "workspace", uuid, "err", err)
		}
		done(jobID, res, err)
	}()
	return jobID, nil
}

// Frame returns the frame at t seconds, extracting and caching it on first use.
func (s *Service) Frame(ctx context.Context, uuid, t string) (string, error) {
	seconds, err := strconv.ParseFloat(t, 64)
	if err != nil || seconds < 0 || math.IsInf(seconds, 0) {
		return "", fmt.Errorf("%w: frame %q", ErrNotFound, t)
	}
	video, err := s.File(uuid, false)
	if err != nil {
		return "", err
	}
	out := filepath.Join(filepath.Dir(video), thumbsDir, "cache", fmt.Sprintf("thumb_%.2f%s", seconds, ThumbExt))
	if isFile(out) {
		return out, nil
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return "", err
	}
	return out, media.ExtractFrame(ctx, video, out, seconds, frameHeight)
}

func (s *Service) existing(uuid, name string) (string, error) {
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, name)
	if !isFile(path) {
		return "", fmt.Errorf("%w: %s", ErrNotFound, filepath.Base(name))
	}
	return path, nil
}

func (s *Service) writeInfo(dir string, meta Metadata) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return files.WriteJSON(filepath.Join(dir, infoFile), map[string]any{"metadata": meta})
}

// updateInfo changes the stored metadata; false if the video is gone (the
// workspace or the video was deleted meanwhile).
func (s *Service) updateInfo(dir string, change func(*Metadata)) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	path := filepath.Join(dir, infoFile)
	var info struct{ Metadata *Metadata }
	if err := files.ReadJSON(path, &info); err != nil || info.Metadata == nil {
		return false
	}
	change(info.Metadata)
	if err := files.WriteJSON(path, map[string]any{"metadata": info.Metadata}); err != nil {
		slog.Error("update video info", "err", err)
		return false
	}
	return true
}

func isFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}
