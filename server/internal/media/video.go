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
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/bartoval/audio_video_editor/server/internal/files"
)

// VideoInfo describes a video file.
type VideoInfo struct {
	Duration    float64 // seconds
	FPS         float64 // average frame rate
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
			AvgFrameRate       string `json:"avg_frame_rate"`
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
			info.FPS = parseRate(s.AvgFrameRate)
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

// parseRate reads a frame rate such as "30000/1001".
func parseRate(rate string) float64 {
	num, den, ok := strings.Cut(rate, "/")
	n, err1 := strconv.ParseFloat(num, 64)
	if !ok {
		return n
	}
	d, err2 := strconv.ParseFloat(den, 64)
	if err1 != nil || err2 != nil || d == 0 {
		return 0
	}
	return n / d
}

// RGBSamples decodes every frame of the video as RGB24 (unrotated) and
// passes the pixels at the given columns and rows: a len(xs) x len(ys) image.
// Only those pixels cross the pipe, a small part of a full frame. The
// buffer is reused between calls.
func RGBSamples(ctx context.Context, video string, xs, ys []int, each func(rgb []byte)) error {
	dir, err := os.MkdirTemp("", "samples-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	if !safePath.MatchString(dir) {
		return fmt.Errorf("temporary directory %q cannot be named in a filter graph", dir)
	}
	// remap reads, for each output pixel, the source column from xmap and the row from ymap.
	xmap, ymap := make([]int, 0, len(xs)*len(ys)), make([]int, 0, len(xs)*len(ys))
	for _, y := range ys {
		for _, x := range xs {
			xmap, ymap = append(xmap, x), append(ymap, y)
		}
	}
	for name, m := range map[string][]int{"x.pgm": xmap, "y.pgm": ymap} {
		if err := writePGM16(filepath.Join(dir, name), len(xs), len(ys), m); err != nil {
			return err
		}
	}
	graph := fmt.Sprintf("movie=%[1]s/x.pgm,format=gray16,loop=-1:1[x];movie=%[1]s/y.pgm,format=gray16,loop=-1:1[y];"+
		"[0:v]format=rgb24[v];[v][x][y]remap=format=color", dir)
	cmd := exec.CommandContext(ctx, "ffmpeg", "-nostdin", "-v", "error", "-noautorotate", "-i", video,
		"-filter_complex", graph, "-an", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	in := bufio.NewReaderSize(stdout, 1<<20)
	frame := make([]byte, len(xs)*len(ys)*3)
	for {
		if _, err := io.ReadFull(in, frame); err != nil {
			break // end of the stream; ffmpeg's exit status tells whether it failed
		}
		each(frame)
	}
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return nil
}

var safePath = regexp.MustCompile(`^[A-Za-z0-9/_.-]+$`)

// writePGM16 writes a 16-bit grayscale PGM image.
func writePGM16(path string, w, h int, pixels []int) error {
	data := fmt.Appendf(nil, "P5 %d %d 65535\n", w, h)
	for _, p := range pixels {
		data = append(data, byte(p>>8), byte(p))
	}
	return os.WriteFile(path, data, 0o600)
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

var (
	nvenc = Encoder{"-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23", "-rc", "vbr", "-movflags", "+faststart"}
	x264  = Encoder{"-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart"}
)

// NewEncoder picks the H.264 encoder: "h264_nvenc" or "libx264" when named,
// otherwise NVENC if this machine can use it (2.5 times faster than x264 on
// a 1080p HEVC upload), else x264.
func NewEncoder(ctx context.Context, name string) Encoder {
	switch name {
	case "h264_nvenc":
		return nvenc
	case "libx264":
		return x264
	}
	// One black frame through NVENC tells whether the GPU and driver support it.
	_, err := run(ctx, "ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=size=256x256:duration=0.04",
		"-c:v", "h264_nvenc", "-f", "null", "-")
	if err != nil {
		return x264
	}
	return nvenc
}

// Name is the encoder name, for logs.
func (e Encoder) Name() string { return e[1] }

// CanCopy reports whether browsers play the video stream as it is, so the
// muted copy needs no re-encoding.
func CanCopy(info VideoInfo) bool {
	return info.Codec == "h264" || info.Codec == "vp9" || info.Codec == "av1"
}

// CopyMuted writes the video stream of in to out as an MP4 without audio and
// with the index first, copying the stream (see CanCopy).
func CopyMuted(ctx context.Context, in, out string, info VideoInfo) error {
	if !info.HasAudio && hasFaststart(in) {
		return copyFile(in, out)
	}
	return Encode(ctx, out, []string{"-i", in, "-an", "-c:v", "copy", "-movflags", "+faststart"})
}

// ExtractFrame writes the frame at t seconds as WebP, scaled to the given height.
func ExtractFrame(ctx context.Context, video, out string, t float64, height int) error {
	return Encode(ctx, out, []string{"-ss", formatFloat(t), "-i", video,
		"-frames:v", "1", "-vf", fmt.Sprintf("scale=-1:%d", height)})
}

// TileSet is one series of thumbnail sheets: a frame every 1/FPS seconds,
// written to Dir/tile_<n>.webp from 0. The highest FPS of a Plan must be a
// multiple of every other.
type TileSet struct {
	Dir string
	FPS float64
}

// Plan lists what Process derives from a video.
type Plan struct {
	Encoder Encoder

	Muted string // when set, the video re-encoded without audio

	Small       string // low resolution copy without audio
	SmallHeight int    // even

	Tiles      []TileSet
	TileHeight int // of one thumbnail
	Cols, Rows int // thumbnails per sheet
	Quality    int // WebP

	Progress func(seconds float64) // position reached in the video
}

// Process decodes the video once and writes everything in the plan. The
// videos appear only if the whole run succeeds.
func Process(ctx context.Context, video string, p Plan) error {
	type output struct{ path, tmp string }
	var outputs []*output
	temp := func(path string) (string, error) {
		f, err := files.Temp(path)
		if err != nil {
			return "", err
		}
		f.Close()
		outputs = append(outputs, &output{path, f.Name()})
		return f.Name(), nil
	}
	defer func() {
		for _, o := range outputs {
			os.Remove(o.tmp) // no-op once renamed
		}
	}()

	// One decoder, split into the muted copy, the small copy and the
	// thumbnails; the thumbnail branch is decimated and scaled once, then split
	// into one branch per tile set plus one that only advances the progress clock.
	branches := []string{"[th]", "[sm]"}
	if p.Muted != "" {
		branches = append(branches, "[mu]")
	}
	maxFPS := 0.0
	for _, s := range p.Tiles {
		maxFPS = max(maxFPS, s.FPS)
	}
	var graph strings.Builder
	fmt.Fprintf(&graph, "[0:v]split=%d%s", len(branches), strings.Join(branches, ""))
	fmt.Fprintf(&graph, ";[sm]scale=-2:%d[small]", p.SmallHeight)
	fmt.Fprintf(&graph, ";[th]fps=%s,scale=-1:%d,split=%d", formatFloat(maxFPS), p.TileHeight, len(p.Tiles)+1)
	for i := range len(p.Tiles) + 1 {
		fmt.Fprintf(&graph, "[t%d]", i)
	}
	// Each set keeps every n-th decimated frame: unlike a second fps filter,
	// this emits the first frame of a sparse set even on short videos.
	for i, s := range p.Tiles {
		every := max(1, int(math.Round(maxFPS/s.FPS)))
		fmt.Fprintf(&graph, ";[t%d]select='not(mod(n\\,%d))',tile=%dx%d[o%d]", i, every, p.Cols, p.Rows, i)
	}

	args := []string{"-nostdin", "-v", "error", "-y", "-i", video, "-filter_complex", graph.String()}
	if p.Muted != "" {
		tmp, err := temp(p.Muted)
		if err != nil {
			return err
		}
		args = append(append(append(args, "-map", "[mu]", "-an"), p.Encoder...), tmp)
	}
	tmp, err := temp(p.Small)
	if err != nil {
		return err
	}
	args = append(append(append(args, "-map", "[small]", "-an"), p.Encoder...), tmp)
	for i, s := range p.Tiles {
		if err := os.MkdirAll(s.Dir, 0o755); err != nil {
			return err
		}
		args = append(args, "-map", fmt.Sprintf("[o%d]", i), "-fps_mode", "passthrough",
			"-c:v", "libwebp", "-quality", strconv.Itoa(p.Quality), "-start_number", "0",
			s.Dir+"/tile_%d.webp")
	}
	args = append(args, "-map", fmt.Sprintf("[t%d]", len(p.Tiles)), "-f", "null", "-", "-progress", "pipe:1")

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
		if v, ok := strings.CutPrefix(scanner.Text(), "out_time_us="); ok && p.Progress != nil {
			if us, err := strconv.ParseInt(v, 10, 64); err == nil && us > 0 {
				p.Progress(float64(us) / 1e6)
			}
		}
	}
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	for _, o := range outputs {
		if err := os.Rename(o.tmp, o.path); err != nil {
			return err
		}
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
