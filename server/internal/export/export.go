// Package export renders the timeline of a workspace: the video with the
// mixed tracks as its audio, or the mix alone as MP3 or WAV, written to
// <workspace>/published/.
//
// Every track goes through one ffmpeg filter graph: cut, volume automation,
// delay, pan, time stretch and pitch shift, then the mix. Nothing is written
// in between.
package export

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/bartoval/audio_video_editor/server/internal/library"
	"github.com/bartoval/audio_video_editor/server/internal/media"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

// ErrInvalid is returned for a timeline that cannot be rendered.
var ErrInvalid = errors.New("invalid export")

// Request is what the frontend sends to publish the timeline.
type Request struct {
	Duration float64 `json:"duration"` // seconds
	Tracks   []Track `json:"tracks"`
	Format   string  `json:"format"` // audio-only export: "mp3" (default) or "wav"
}

// Track is a timeline track, as exported by the frontend.
type Track struct {
	IDTrack       json.RawMessage `json:"idTrack"` // library id
	StartTime     float64         `json:"startTime"`
	StretchFactor *float64        `json:"stretchFactor"` // output length / input length; default 1
	Pitch         float64         `json:"pitch"`         // semitones
	Gain          *float64        `json:"gain"`          // default 1
	PanValue      float64         `json:"panValue"`      // -1 left … 1 right
	VolumeValues  []struct {
		Data struct {
			Times  []float64 `json:"times"`
			Values []float64 `json:"values"`
		} `json:"data"`
	} `json:"volumeValues"`
	IsCut              bool    `json:"isCut"`
	StartTimeBuffer    float64 `json:"startTimeBuffer"`
	DurationTimeBuffer float64 `json:"durationTimeBuffer"`
	DurationTimeCut    float64 `json:"durationTimeCut"`
}

// Result names the published file.
type Result struct {
	URL    string `json:"res"`
	Type   string `json:"type"` // "video" or "audio"
	Format string `json:"format,omitempty"`
}

// Service renders timelines.
type Service struct {
	ws      *workspace.Store
	library *library.Library
}

// New returns the export service.
func New(ws *workspace.Store, lib *library.Library) *Service {
	return &Service{ws: ws, library: lib}
}

const (
	videoFile = "video.mp4"
	published = "published"
)

// Export renders the timeline: over the workspace video when there is one,
// as audio only otherwise.
func (s *Service) Export(ctx context.Context, uuid string, req Request) (Result, error) {
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return Result{}, err
	}
	if !(req.Duration > 0) || math.IsInf(req.Duration, 0) {
		return Result{}, fmt.Errorf("%w: duration must be positive", ErrInvalid)
	}
	var args []string
	video := filepath.Join(dir, videoFile)
	hasVideo := isFile(video)
	if hasVideo {
		args = append(args, "-i", video)
	} else if len(req.Tracks) == 0 {
		return Result{}, fmt.Errorf("%w: no audio tracks to export", ErrInvalid)
	}

	first := len(args) / 2 // input index of the first track
	var graph []string
	for i, t := range req.Tracks {
		src, chain, input, err := s.track(uuid, t, req.Duration)
		if err != nil {
			return Result{}, fmt.Errorf("track %d: %w", i, err)
		}
		args = append(append(args, input...), "-i", src)
		graph = append(graph, fmt.Sprintf("[%d:a]%s[a%d]", first+i, chain, i))
	}
	if len(req.Tracks) > 0 {
		var mix strings.Builder
		for i := range req.Tracks {
			fmt.Fprintf(&mix, "[a%d]", i)
		}
		// normalize=0: the plain sum, which does not rise when a track ends.
		fmt.Fprintf(&mix, "amix=inputs=%d:normalize=0:duration=longest[mix]", len(req.Tracks))
		graph = append(graph, mix.String())
		args = append(args, "-filter_complex", strings.Join(graph, ";"))
	}
	args = append(args, "-t", formatFloat(req.Duration))

	if err := os.MkdirAll(filepath.Join(dir, published), 0o755); err != nil {
		return Result{}, err
	}
	base := "/api/v1/workspaces/" + uuid + "/exports/"
	if hasVideo {
		args = append(args, "-map", "0:v", "-c:v", "copy")
		if len(req.Tracks) > 0 {
			args = append(args, "-map", "[mix]", "-c:a", "aac", "-b:a", "256k")
		}
		args = append(args, "-movflags", "+faststart")
		if err := media.Encode(ctx, filepath.Join(dir, published, "out.mp4"), args); err != nil {
			return Result{}, err
		}
		return Result{URL: base + "out", Type: "video"}, nil
	}

	format := "mp3"
	args = append(args, "-map", "[mix]")
	if req.Format == "wav" {
		format = "wav"
		args = append(args, "-c:a", "pcm_s16le")
	} else {
		args = append(args, "-c:a", "libmp3lame", "-q:a", "2")
	}
	if err := media.Encode(ctx, filepath.Join(dir, published, "out."+format), args); err != nil {
		return Result{}, err
	}
	return Result{URL: base + "audio." + format, Type: "audio", Format: format}, nil
}

// track returns the source of a track, its filter chain and the input
// options that cut it.
func (s *Service) track(uuid string, t Track, duration float64) (src, chain string, input []string, err error) {
	var id string
	if json.Unmarshal(t.IDTrack, &id) != nil || id == "" {
		// -1 was the audio of the video, which is no longer kept.
		return "", "", nil, fmt.Errorf("%w: idTrack %s is not a library track", ErrInvalid, t.IDTrack)
	}
	if src, err = s.library.File(uuid, id); err != nil {
		return "", "", nil, err
	}
	stretch, gain := 1.0, 1.0
	if t.StretchFactor != nil {
		stretch = *t.StretchFactor
	}
	if t.Gain != nil {
		gain = *t.Gain
	}
	for _, v := range []float64{stretch, gain, t.Pitch, t.StartTime, t.PanValue, t.StartTimeBuffer, t.DurationTimeBuffer, t.DurationTimeCut} {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return "", "", nil, fmt.Errorf("%w: number out of range", ErrInvalid)
		}
	}
	if stretch < 0.01 || stretch > 100 {
		return "", "", nil, fmt.Errorf("%w: stretch factor %v", ErrInvalid, stretch)
	}

	if t.IsCut {
		cut := t.DurationTimeCut
		if t.DurationTimeBuffer > 0 {
			cut = t.DurationTimeBuffer
		}
		if cut > 0 {
			input = []string{"-ss", formatFloat(t.StartTimeBuffer), "-t", formatFloat(cut)}
		}
	}

	filters := []string{volumeFilter(t, gain, duration)}
	if t.StartTime > 0 {
		// The delay is stretched with the rest, so it is given in source time.
		ms := formatFloat(t.StartTime / stretch * 1000)
		filters = append(filters, "adelay="+ms+"|"+ms)
	}
	if t.PanValue != 0 {
		filters = append(filters, panFilter(t.PanValue))
	}
	if stretch != 1 || t.Pitch != 0 {
		filters = append(filters, fmt.Sprintf("rubberband=tempo=%s:pitch=%s",
			formatFloat(1/stretch), formatFloat(math.Pow(2, t.Pitch/12))))
	}
	filters = append(filters, "aformat=sample_rates=44100:channel_layouts=stereo")
	return src, strings.Join(filters, ","), input, nil
}

// volumeFilter turns the volume automation into volume filters, each enabled
// over a time range. Curves are sampled every tenth point and steady stretches
// merged, as in the Node API.
func volumeFilter(t Track, gain, duration float64) string {
	const every, threshold = 10, 0.001
	var segments []string
	add := func(value float64, from, to string) {
		segments = append(segments, fmt.Sprintf("volume=%.5f:eval=frame:enable='between(t,%s,%s)'", value, from, to))
	}
	for j, curve := range t.VolumeValues {
		times, values := curve.Data.Times, curve.Data.Values
		n := min(len(times), len(values))
		if n == 0 {
			continue
		}
		if j == 0 && times[0] > 0 {
			add(gain, "0", formatFloat(times[0]))
		}
		prev, start, hasPrev := 0.0, 0, false
		for i := range n {
			if i != 0 && i != n-1 && i%every != 0 {
				continue
			}
			v := values[i] * gain
			if hasPrev && math.Abs(v-prev) < threshold {
				continue
			}
			if hasPrev && start < i {
				if t1, t2 := fmt.Sprintf("%.5f", times[start]), fmt.Sprintf("%.5f", times[i]); t1 != t2 {
					add(prev, t1, t2)
				}
			}
			prev, start, hasPrev = v, i, true
		}
		next := duration
		if j < len(t.VolumeValues)-1 && len(t.VolumeValues[j+1].Data.Times) > 0 {
			next = t.VolumeValues[j+1].Data.Times[0]
		}
		if last := times[n-1]; last < next {
			add(values[n-1]*gain, formatFloat(last), formatFloat(next))
		}
	}
	if len(segments) == 0 {
		return fmt.Sprintf("volume=%.5f", gain)
	}
	return strings.Join(segments, ",")
}

// panFilter attenuates the side opposite to the pan.
func panFilter(pan float64) string {
	gain := formatFloat(1 - math.Abs(pan))
	left, right := "c0", "c1"
	if pan > 0 {
		left = gain + "*c0"
	} else {
		right = gain + "*c1"
	}
	return "pan=stereo|FL<" + left + "|FR<" + right
}

// File returns a published export: "out" (video), "audio.mp3" or "audio.wav".
func (s *Service) File(uuid, name string) (path, contentType string, err error) {
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return "", "", err
	}
	switch name {
	case "out":
		path, contentType = filepath.Join(dir, published, "out.mp4"), "video/mp4"
	case "audio.mp3":
		path, contentType = filepath.Join(dir, published, "out.mp3"), "audio/mpeg"
	case "audio.wav":
		path, contentType = filepath.Join(dir, published, "out.wav"), "audio/wav"
	}
	if path == "" || !isFile(path) {
		return "", "", fmt.Errorf("%w: %s", library.ErrNotFound, name)
	}
	return path, contentType, nil
}

func formatFloat(f float64) string { return strconv.FormatFloat(f, 'f', -1, 64) }

func isFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}
