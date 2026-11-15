// Package library manages the audio library of a workspace:
//
//	<workspace>/trackList.json      metadata of the library tracks
//	<workspace>/library/<id>        uploaded audio
//	<workspace>/library/derived/    stretched sections (not listed)
//	<workspace>/library/cache/      tracks converted for download
package library

import (
	"context"
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bartoval/audio_video_editor/server/internal/files"
	"github.com/bartoval/audio_video_editor/server/internal/media"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

var (
	// ErrNotFound is returned when an audio file does not exist.
	ErrNotFound = errors.New("audio file not found")
	// ErrInvalid is returned for malformed requests.
	ErrInvalid = errors.New("invalid request")
)

// OriginalAudio is the track id of the audio extracted from the video.
const OriginalAudio = "-1"

// Library reads and writes the audio libraries of all workspaces.
type Library struct {
	ws *workspace.Store
	mu sync.Mutex // serializes changes to trackList.json
}

// New returns the library of the workspaces in ws.
func New(ws *workspace.Store) *Library { return &Library{ws: ws} }

// Track is the metadata stored for an uploaded file.
type Track struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Duration          float64 `json:"duration"` // milliseconds
	DurationFormatted string  `json:"durationFormatted"`
	ChannelLayout     string  `json:"channelLayout"`
	BitDepth          int     `json:"bitDepth"`
	SampleRate        int     `json:"sampleRate"`
	Bitrate           int     `json:"bitrate"` // kbit/s
	Codec             string  `json:"codec"`
	Format            string  `json:"format"`
	FileSize          int64   `json:"fileSize"`
	CreatedAt         string  `json:"createdAt"`
	Provider          string  `json:"provider,omitempty"`
	Source            string  `json:"source,omitempty"`
	Hash              string  `json:"hash"`
}

// List returns the metadata of the library tracks by id. Entries whose file
// is gone are removed.
func (l *Library) List(uuid string) (map[string]json.RawMessage, error) {
	dir, err := l.ws.Dir(uuid)
	if err != nil {
		return nil, err
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	list, err := readTrackList(dir)
	if err != nil {
		return nil, err
	}
	pruned := false
	for id := range list.tracks {
		if !isFile(filepath.Join(dir, "library", id)) {
			delete(list.tracks, id)
			pruned = true
			slog.Warn("pruned missing audio from track list", "workspace", uuid, "id", id)
		}
	}
	if pruned {
		if err := list.write(dir); err != nil {
			return nil, err
		}
	}
	return list.tracks, nil
}

// File returns the path of a library track.
func (l *Library) File(uuid, id string) (string, error) {
	return l.path(uuid, "library", id)
}

// Derived returns the path of a stretched section.
func (l *Library) Derived(uuid, id string) (string, error) {
	return l.path(uuid, filepath.Join("library", "derived"), id)
}

func (l *Library) path(uuid, sub, id string) (string, error) {
	dir, err := l.ws.Dir(uuid)
	if err != nil {
		return "", err
	}
	id, err = cleanID(id)
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, sub, id)
	if !isFile(path) {
		return "", fmt.Errorf("%w: %s", ErrNotFound, id)
	}
	return path, nil
}

// cleanID accepts a plain file name. Anything after "?", "&" or "#" is
// dropped: some callers append cache busters to the id.
func cleanID(id string) (string, error) {
	if i := strings.IndexAny(id, "?&#"); i >= 0 {
		id = id[:i]
	}
	if id == "" || id == "." || id == ".." || id != filepath.Base(id) || strings.ContainsRune(id, 0) {
		return "", fmt.Errorf("%w: %q", ErrNotFound, id)
	}
	return id, nil
}

// Import describes an uploaded file to add to the library.
type Import struct {
	Src      string // assembled upload
	Filename string // name chosen by the user
	Provider string
	Source   string
}

// ImportResult is the track added, or the existing track with the same content.
type ImportResult struct {
	Track     json.RawMessage
	ID        string
	Duplicate bool
}

// Import moves an uploaded file into the library, reads its metadata and
// adds it to the track list, unless the same content is already there.
func (l *Library) Import(ctx context.Context, uuid string, in Import) (ImportResult, error) {
	defer os.Remove(in.Src) // no-op once moved
	dir, err := l.ws.Dir(uuid)
	if err != nil {
		return ImportResult{}, err
	}
	hash, size, err := hashFile(in.Src)
	if err != nil {
		return ImportResult{}, err
	}

	base, ext := splitName(in.Filename)
	id := fmt.Sprintf("%s-%d-%s%s", base, time.Now().UnixMilli(), randomSuffix(), ext)
	path := filepath.Join(dir, "library", id)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return ImportResult{}, err
	}
	if err := files.Move(in.Src, path); err != nil {
		return ImportResult{}, err
	}

	track := Track{
		ID: id, Name: base, DurationFormatted: "00:00.00", ChannelLayout: "stereo",
		Format: strings.TrimPrefix(ext, "."), FileSize: size, Hash: hash,
		CreatedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		Provider:  in.Provider, Source: in.Source,
	}
	if info, err := media.ProbeAudio(ctx, path); err != nil {
		slog.Warn("probe audio", "id", id, "err", err)
	} else {
		track.Duration = info.Duration * 1000
		track.DurationFormatted = media.FormatDuration(info.Duration)
		track.Bitrate, track.Codec = info.Bitrate, info.Codec
		track.SampleRate, track.BitDepth = info.SampleRate, info.BitDepth
		track.ChannelLayout = info.ChannelLayout
	}
	raw, err := json.Marshal(track)
	if err != nil {
		return ImportResult{}, err
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	list, err := readTrackList(dir)
	if err != nil {
		os.Remove(path)
		return ImportResult{}, err
	}
	if dupID, dup := list.findHash(hash); dup {
		os.Remove(path)
		return ImportResult{Track: list.tracks[dupID], ID: dupID, Duplicate: true}, nil
	}
	list.tracks[id] = raw
	if err := list.write(dir); err != nil {
		os.Remove(path)
		return ImportResult{}, err
	}
	return ImportResult{Track: raw, ID: id}, nil
}

// Delete removes a track and its converted copies.
func (l *Library) Delete(uuid, id string) error {
	path, err := l.File(uuid, id)
	if err != nil {
		return err
	}
	id = filepath.Base(path)
	dir := filepath.Dir(filepath.Dir(path))

	l.mu.Lock()
	defer l.mu.Unlock()
	if err := os.Remove(path); err != nil {
		return err
	}
	base, _ := splitName(id)
	for _, format := range []string{"mp3", "wav"} {
		os.Remove(filepath.Join(dir, "library", "cache", base+"."+format))
	}
	list, err := readTrackList(dir)
	if err != nil {
		return err
	}
	if _, ok := list.tracks[id]; !ok {
		return nil
	}
	delete(list.tracks, id)
	return list.write(dir)
}

// Stretch time-stretches a section of a track (or of the video audio, with
// OriginalAudio) into an MP3 under library/derived and returns its id. The
// id encodes the parameters, so a repeated request reuses the file.
func (l *Library) Stretch(ctx context.Context, uuid, id string, s media.Stretch) (outID string, cached bool, err error) {
	if !(s.Ratio > 0 && s.Ratio <= 10) || math.IsNaN(s.Semitones) || s.Start < 0 || s.Duration < 0 {
		return "", false, fmt.Errorf("%w: ratio must be between 0 and 10, times must be positive", ErrInvalid)
	}
	dir, err := l.ws.Dir(uuid)
	if err != nil {
		return "", false, err
	}
	src, name := filepath.Join(dir, "resources", "audioTracks", "audio.wav"), "original-audio.wav"
	if id != OriginalAudio {
		if src, err = l.File(uuid, id); err != nil {
			return "", false, err
		}
		name = filepath.Base(src)
	}
	if !isFile(src) {
		return "", false, fmt.Errorf("%w: %s", ErrNotFound, name)
	}

	base, _ := splitName(name)
	outID = fmt.Sprintf("%s-s%s-p%s-t%s-d%s.mp3", base,
		idNumber(s.Ratio), idNumber(s.Semitones), idNumber(s.Start), idNumber(s.Duration))
	out := filepath.Join(dir, "library", "derived", outID)
	if isFile(out) {
		return outID, true, nil
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return "", false, err
	}
	return outID, false, media.StretchToMP3(ctx, src, out, s)
}

// Converted returns a track as "mp3" or "wav", converting it once into
// library/cache, and the file name to offer for download.
func (l *Library) Converted(ctx context.Context, uuid, id, format string) (path, filename string, err error) {
	src, err := l.File(uuid, id)
	if err != nil {
		return "", "", err
	}
	base, ext := splitName(filepath.Base(src))
	if strings.EqualFold(ext, "."+format) {
		return src, filepath.Base(src), nil
	}
	filename = base + "." + format
	path = filepath.Join(filepath.Dir(src), "cache", filename)
	if isFile(path) {
		return path, filename, nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", "", err
	}
	return path, filename, media.ConvertAudio(ctx, src, path, format)
}

// trackList is trackList.json. Unknown keys and track fields are kept as they are.
type trackList struct {
	other  map[string]json.RawMessage
	tracks map[string]json.RawMessage
}

func readTrackList(dir string) (*trackList, error) {
	l := &trackList{other: map[string]json.RawMessage{}, tracks: map[string]json.RawMessage{}}
	err := files.ReadJSON(filepath.Join(dir, "trackList.json"), &l.other)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	if raw, ok := l.other["tracks"]; ok {
		if err := json.Unmarshal(raw, &l.tracks); err != nil {
			return nil, err
		}
		if l.tracks == nil { // "tracks": null
			l.tracks = map[string]json.RawMessage{}
		}
	}
	return l, nil
}

func (l *trackList) write(dir string) error {
	tracks, err := json.Marshal(l.tracks)
	if err != nil {
		return err
	}
	l.other["tracks"] = tracks
	return files.WriteJSON(filepath.Join(dir, "trackList.json"), l.other)
}

func (l *trackList) findHash(hash string) (string, bool) {
	for id, raw := range l.tracks {
		var t struct {
			Hash string `json:"hash"`
		}
		if json.Unmarshal(raw, &t) == nil && t.Hash != "" && t.Hash == hash {
			return id, true
		}
	}
	return "", false
}

var unsafeChars = regexp.MustCompile(`[^A-Za-z0-9._-]`)

// splitName returns the sanitized base name and the extension of a file name.
func splitName(name string) (base, ext string) {
	name = filepath.Base(name)
	ext = filepath.Ext(name)
	base = unsafeChars.ReplaceAllString(strings.TrimSuffix(name, ext), "_")
	return base, unsafeChars.ReplaceAllString(ext, "")
}

func randomSuffix() string {
	b := make([]byte, 5)
	rand.Read(b)
	return hex.EncodeToString(b)[:9]
}

// idNumber formats a number for a file name: "1.5" -> "1_5".
func idNumber(f float64) string {
	return strings.ReplaceAll(strconv.FormatFloat(f, 'f', -1, 64), ".", "_")
}

func hashFile(path string) (hash string, size int64, err error) {
	f, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	h := sha1.New()
	size, err = io.Copy(h, f)
	return hex.EncodeToString(h.Sum(nil)), size, err
}

func isFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}
