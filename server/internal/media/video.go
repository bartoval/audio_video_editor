package media

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/bartoval/audio_video_editor/server/internal/files"
)

// VideoInfo describes a video file.
type VideoInfo struct {
	Duration    float64 // seconds
	Width       int
	Height      int
	Codec       string
	AspectRatio string // display aspect ratio, e.g. "16:9"
	HasAudio    bool
	Title       string
}

// ProbeVideo reads the format and first video stream of a file.
func ProbeVideo(ctx context.Context, path string) (VideoInfo, error) {
	out, err := run(ctx, "ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path)
	if err != nil {
		return VideoInfo{}, err
	}
	var probe struct {
		Format struct {
			Duration string            `json:"duration"`
			Tags     map[string]string `json:"tags"`
		} `json:"format"`
		Streams []struct {
			CodecType          string `json:"codec_type"`
			CodecName          string `json:"codec_name"`
			Width              int    `json:"width"`
			Height             int    `json:"height"`
			DisplayAspectRatio string `json:"display_aspect_ratio"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(out, &probe); err != nil {
		return VideoInfo{}, fmt.Errorf("ffprobe output: %w", err)
	}
	info := VideoInfo{Width: 1920, Height: 1080, Title: probe.Format.Tags["title"]}
	info.Duration, _ = strconv.ParseFloat(probe.Format.Duration, 64)
	video := false
	for _, s := range probe.Streams {
		switch {
		case s.CodecType == "audio":
			info.HasAudio = true
		case s.CodecType == "video" && !video:
			video = true
			info.Codec, info.AspectRatio = s.CodecName, s.DisplayAspectRatio
			if s.Width > 0 && s.Height > 0 {
				info.Width, info.Height = s.Width, s.Height
			}
			if info.AspectRatio == "" || info.AspectRatio == "N/A" || info.AspectRatio == "0:1" {
				info.AspectRatio = aspectRatio(s.Width, s.Height)
			}
		}
	}
	if !video {
		return VideoInfo{}, fmt.Errorf("no video stream in %s", path)
	}
	return info, nil
}

// aspectRatio names the common ratios and falls back to "w:h".
func aspectRatio(w, h int) string {
	if w <= 0 || h <= 0 {
		return ""
	}
	r := float64(w) / float64(h)
	for _, c := range []struct {
		name  string
		ratio float64
	}{{"16:9", 16.0 / 9}, {"4:3", 4.0 / 3}, {"21:9", 21.0 / 9}} {
		if r > c.ratio-0.1 && r < c.ratio+0.1 {
			return c.name
		}
	}
	return fmt.Sprintf("%d:%d", w, h)
}

// Encoder holds the ffmpeg arguments of the H.264 encoder.
type Encoder []string

// NewEncoder returns the NVIDIA encoder for "h264_nvenc" and the CPU one otherwise.
func NewEncoder(name string) Encoder {
	if name == "h264_nvenc" {
		return Encoder{"-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23", "-rc", "vbr", "-movflags", "+faststart"}
	}
	return Encoder{"-c:v", "libx264", "-preset", "medium", "-crf", "23", "-movflags", "+faststart"}
}

// MuteVideo writes the video stream of in to out as a browser-ready MP4
// without audio. Web codecs are copied, the others re-encoded.
func MuteVideo(ctx context.Context, in, out string, info VideoInfo, enc Encoder) error {
	webCodec := info.Codec == "h264" || info.Codec == "vp9" || info.Codec == "av1"
	if webCodec && !info.HasAudio && hasFaststart(in) {
		return copyFile(in, out)
	}
	args := []string{"-i", in, "-an"}
	if webCodec {
		args = append(args, "-c:v", "copy", "-movflags", "+faststart")
	} else {
		args = append(args, enc...)
	}
	return encode(ctx, out, args)
}

// SmallVideo writes a muted copy of in scaled to the given height.
func SmallVideo(ctx context.Context, in, out string, height int, enc Encoder) error {
	args := append([]string{"-i", in, "-an", "-vf", fmt.Sprintf("scale=-2:%d", height)}, enc...)
	return encode(ctx, out, args)
}

// ExtractFrame writes the frame at t seconds as WebP, scaled to the given height.
func ExtractFrame(ctx context.Context, video, out string, t float64, height int) error {
	return encode(ctx, out, []string{"-ss", formatFloat(t), "-i", video,
		"-frames:v", "1", "-vf", fmt.Sprintf("scale=-1:%d", height)})
}

// TileSet is one series of thumbnail sheets: a frame every 1/FPS seconds,
// Cols x Rows frames per sheet, written to Dir/tile_<n>.webp from 0. The
// highest FPS must be a multiple of every other.
type TileSet struct {
	Dir string
	FPS float64
}

// Tiles decodes the video once and writes every tile set. progress receives
// the position reached, in seconds.
func Tiles(ctx context.Context, video string, sets []TileSet, height, cols, rows, quality int, progress func(float64)) error {
	maxFPS := 0.0
	for _, s := range sets {
		maxFPS = max(maxFPS, s.FPS)
	}
	// Decimate and scale once, then split: one branch per set plus one that
	// only advances the progress clock smoothly.
	var graph strings.Builder
	fmt.Fprintf(&graph, "[0:v]fps=%s,scale=-1:%d,split=%d", formatFloat(maxFPS), height, len(sets)+1)
	for i := range len(sets) + 1 {
		fmt.Fprintf(&graph, "[s%d]", i)
	}
	// Each set keeps every n-th decimated frame: unlike a second fps filter,
	// this emits the first frame of a sparse set even on short videos.
	for i, s := range sets {
		every := max(1, int(math.Round(maxFPS/s.FPS)))
		fmt.Fprintf(&graph, ";[s%d]select='not(mod(n\\,%d))',tile=%dx%d[o%d]", i, every, cols, rows, i)
	}
	args := []string{"-nostdin", "-v", "error", "-i", video, "-filter_complex", graph.String()}
	for i, s := range sets {
		if err := os.MkdirAll(s.Dir, 0o755); err != nil {
			return err
		}
		args = append(args, "-map", fmt.Sprintf("[o%d]", i), "-fps_mode", "passthrough",
			"-c:v", "libwebp", "-quality", strconv.Itoa(quality), "-start_number", "0",
			s.Dir+"/tile_%d.webp")
	}
	args = append(args, "-map", fmt.Sprintf("[s%d]", len(sets)), "-f", "null", "-", "-progress", "pipe:1")

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		if v, ok := strings.CutPrefix(scanner.Text(), "out_time_us="); ok && progress != nil {
			if us, err := strconv.ParseInt(v, 10, 64); err == nil && us > 0 {
				progress(float64(us) / 1e6)
			}
		}
	}
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return nil
}

// hasFaststart reports whether the MP4 index (moov) comes before the media
// data (mdat), so browsers can start playing before the download ends.
func hasFaststart(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	head := make([]byte, 1<<20)
	n, _ := io.ReadFull(f, head)
	moov := bytes.Index(head[:n], []byte("moov"))
	mdat := bytes.Index(head[:n], []byte("mdat"))
	return moov >= 0 && mdat >= 0 && moov < mdat
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	tmp, err := files.Temp(dst)
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := io.Copy(tmp, in); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), dst)
}
