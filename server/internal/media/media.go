// Package media runs ffprobe and ffmpeg.
package media

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/bartoval/audio_video_editor/server/internal/files"
)

// AudioInfo describes the first audio stream of a file.
type AudioInfo struct {
	Duration      float64 // seconds
	Bitrate       int     // kbit/s
	Codec         string
	SampleRate    int
	BitDepth      int
	ChannelLayout string
}

// ProbeAudio reads the format and first audio stream of a file.
func ProbeAudio(ctx context.Context, path string) (AudioInfo, error) {
	out, err := run(ctx, "ffprobe", "-v", "error", "-print_format", "json",
		"-show_format", "-show_streams", "-select_streams", "a:0", path)
	if err != nil {
		return AudioInfo{}, err
	}
	var probe struct {
		Format struct {
			Duration string `json:"duration"`
			BitRate  string `json:"bit_rate"`
		} `json:"format"`
		Streams []struct {
			CodecName     string `json:"codec_name"`
			SampleRate    string `json:"sample_rate"`
			Channels      int    `json:"channels"`
			ChannelLayout string `json:"channel_layout"`
			BitsPerSample int    `json:"bits_per_sample"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(out, &probe); err != nil {
		return AudioInfo{}, fmt.Errorf("ffprobe output: %w", err)
	}

	info := AudioInfo{ChannelLayout: "stereo"}
	info.Duration, _ = strconv.ParseFloat(probe.Format.Duration, 64)
	bitrate, _ := strconv.ParseFloat(probe.Format.BitRate, 64)
	info.Bitrate = int(math.Round(bitrate / 1000))
	if len(probe.Streams) > 0 {
		s := probe.Streams[0]
		info.Codec = s.CodecName
		info.SampleRate, _ = strconv.Atoi(s.SampleRate)
		info.BitDepth = s.BitsPerSample
		info.ChannelLayout = channelLayout(s.ChannelLayout, s.Channels)
	}
	return info, nil
}

// channelLayout names the layout; some WAV streams report none.
func channelLayout(layout string, channels int) string {
	switch {
	case layout != "" && layout != "unknown":
		return layout
	case channels == 1:
		return "mono"
	case channels > 2:
		return fmt.Sprintf("%dch", channels)
	}
	return "stereo"
}

// DecodeStereo decodes the audio of any audio or video file to planar float32
// stereo at the given sample rate: audio[channel][sample].
func DecodeStereo(ctx context.Context, path string, sampleRate int) ([][]float32, error) {
	raw, err := run(ctx, "ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn",
		"-ac", "2", "-ar", strconv.Itoa(sampleRate), "-f", "f32le", "pipe:1")
	if err != nil {
		return nil, err
	}
	frames := len(raw) / 8
	audio := [][]float32{make([]float32, frames), make([]float32, frames)}
	for i := range frames {
		audio[0][i] = math.Float32frombits(binary.LittleEndian.Uint32(raw[i*8:]))
		audio[1][i] = math.Float32frombits(binary.LittleEndian.Uint32(raw[i*8+4:]))
	}
	return audio, nil
}

// Stretch describes a time stretch of a section of audio.
type Stretch struct {
	Ratio     float64 // output duration / input duration
	Semitones float64 // pitch shift
	Start     float64 // seconds; 0 = from the beginning
	Duration  float64 // seconds; 0 = to the end
}

// StretchToMP3 time-stretches and pitch-shifts a section of in and writes
// it to out as MP3.
func StretchToMP3(ctx context.Context, in, out string, s Stretch) error {
	var args []string
	if s.Start > 0 {
		args = append(args, "-ss", formatFloat(s.Start))
	}
	if s.Duration > 0 {
		args = append(args, "-t", formatFloat(s.Duration))
	}
	filter := fmt.Sprintf("rubberband=tempo=%s:pitch=%s",
		formatFloat(1/s.Ratio), formatFloat(math.Pow(2, s.Semitones/12)))
	args = append(args, "-i", in, "-af", filter, "-c:a", "libmp3lame", "-q:a", "3")
	return encode(ctx, out, args)
}

// ConvertAudio converts in to "mp3" (320 kbit/s) or "wav" (16 bit, 44.1 kHz, stereo).
func ConvertAudio(ctx context.Context, in, out, format string) error {
	args := []string{"-i", in, "-vn"}
	if format == "wav" {
		args = append(args, "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2")
	} else {
		args = append(args, "-c:a", "libmp3lame", "-b:a", "320k")
	}
	return encode(ctx, out, args)
}

// encode runs ffmpeg with args and publishes out only when it succeeds, so a
// reader never sees a half-written file.
func encode(ctx context.Context, out string, args []string) error {
	tmp, err := files.Temp(out)
	if err != nil {
		return err
	}
	tmp.Close()
	defer os.Remove(tmp.Name())

	args = append([]string{"-nostdin", "-v", "error", "-y"}, args...)
	if _, err := run(ctx, "ffmpeg", append(args, tmp.Name())...); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), out)
}

// run executes a command and returns its stdout; errors carry the end of stderr.
func run(ctx context.Context, name string, args ...string) ([]byte, error) {
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if len(msg) > 500 {
			msg = "..." + msg[len(msg)-500:]
		}
		return nil, fmt.Errorf("%s: %w: %s", name, err, msg)
	}
	return stdout.Bytes(), nil
}

func formatFloat(f float64) string { return strconv.FormatFloat(f, 'f', -1, 64) }

// FormatDuration formats seconds as MM:SS.cc, like the Node API.
func FormatDuration(seconds float64) string {
	minutes := int(seconds/60) % 60
	secs := int(seconds) % 60
	centis := int(math.Mod(seconds*100, 100))
	return fmt.Sprintf("%02d:%02d.%02d", minutes, secs, centis)
}
