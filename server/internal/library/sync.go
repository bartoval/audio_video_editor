package library

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/bartoval/audio_video_editor/server/internal/files"
	"github.com/bartoval/audio_video_editor/server/internal/media"
)

// Sync stores the original bytes under the stable id chosen on the device.
// Existing ids are immutable: a retry may repeat the same bytes, never replace them.
func (l *Library) Sync(ctx context.Context, uuid, id, src, filename string, derived bool) error {
	defer os.Remove(src)
	clean, err := cleanID(id)
	if err != nil || clean != id || strings.Contains(id, `\`) {
		return ErrInvalid
	}
	dir, err := l.ws.Dir(uuid)
	if err != nil {
		return err
	}
	hash, size, err := hashFile(src)
	if err != nil {
		return err
	}
	sub := "library"
	if derived {
		sub = filepath.Join(sub, "derived")
	}
	path := filepath.Join(dir, sub, id)
	l.mu.Lock()
	defer l.mu.Unlock()
	if isFile(path) {
		existing, _, err := hashFile(path)
		if err != nil {
			return err
		}
		if existing != hash {
			return fmt.Errorf("%w: media id already has different content", ErrInvalid)
		}
	} else {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		if err := files.Move(src, path); err != nil {
			return err
		}
	}
	if derived {
		return nil
	}
	list, err := readTrackList(dir)
	if err != nil {
		return err
	}
	if _, exists := list.tracks[id]; exists {
		return nil
	}
	base, ext := splitName(filename)
	track := Track{ID: id, Name: base, Format: strings.TrimPrefix(ext, "."), FileSize: size, Hash: hash,
		CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	if info, err := media.ProbeAudio(ctx, path); err == nil {
		track.Duration = info.Duration * 1000
		track.DurationFormatted = media.FormatDuration(info.Duration)
		track.Bitrate, track.Codec = info.Bitrate, info.Codec
		track.SampleRate, track.BitDepth, track.ChannelLayout = info.SampleRate, info.BitDepth, info.ChannelLayout
	}
	raw, err := json.Marshal(track)
	if err != nil {
		return err
	}
	list.tracks[id] = raw
	return list.write(dir)
}
