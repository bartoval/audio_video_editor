package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVideo(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	// H.264 is copied; MPEG-4 Part 2 is re-encoded in the same pass as the rest.
	t.Run("copy", func(t *testing.T) { testVideo(t, "clip.mkv", "libx264") })
	t.Run("reencode", func(t *testing.T) { testVideo(t, "clip.avi", "mpeg4") })
}

func testVideo(t *testing.T, name, codec string) {
	srv, root := newTestServer(t)
	_, body := call(t, srv, "POST", "/api/v1/workspaces", `{"title":"Clip"}`)
	var ws struct{ UUID string }
	json.Unmarshal([]byte(body), &ws)
	base := "/api/v1/workspaces/" + ws.UUID + "/video"

	if status, _ := call(t, srv, "GET", base, ""); status != 404 {
		t.Errorf("metadata before upload: status %d, want 404", status)
	}

	// 25 s of 640x360 video with audio.
	src := filepath.Join(t.TempDir(), name)
	err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=25",
		"-f", "lavfi", "-i", "sine=duration=25", "-c:v", codec, "-pix_fmt", "yuv420p",
		"-c:a", "aac", "-metadata", "title=Test clip", src).Run()
	if err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(src)
	const chunk = 64 << 10
	var last map[string]any
	for n := 1; n <= (len(data)+chunk-1)/chunk; n++ {
		last = uploadChunk(t, srv.URL+base+"/file", "vid-1", name, data, n, chunk)
	}
	if last["status"] != "complete" {
		t.Fatalf("upload: %v", last)
	}

	events := eventStream(t, srv.URL+"/api/v1/workspaces/"+ws.UUID+"/events")
	waitEvent(t, events, "connected")
	if status, _ := call(t, srv, "POST", base+"/convert", `{"priorityScale":"0.1"}`); status != 200 {
		t.Fatalf("convert: status %d", status)
	}

	// The frontend polls until the video is playable.
	var conv struct {
		ConversionComplete bool
		Metadata           map[string]any
	}
	for deadline := time.Now().Add(30 * time.Second); !conv.ConversionComplete; time.Sleep(100 * time.Millisecond) {
		if time.Now().After(deadline) {
			t.Fatal("conversion did not complete")
		}
		_, body := call(t, srv, "GET", base+"/convert", "")
		json.Unmarshal([]byte(body), &conv)
	}
	if conv.Metadata["name"] != "Test clip" || conv.Metadata["displayAspectRatio"] != "16:9" ||
		!strings.HasPrefix(conv.Metadata["durationFormatted"].(string), "00:25.0") {
		t.Errorf("metadata: %v", conv.Metadata)
	}

	// Thumbnails: one event per scale, the priority one first, then "complete".
	var scales []string
	for {
		p := waitEvent(t, events, "thumbnails")
		if p["status"] == "scale_complete" {
			scales = append(scales, p["progress"].(map[string]any)["scale"].(string))
		}
		if p["status"] == "complete" {
			break
		}
		if p["status"] == "error" {
			t.Fatalf("thumbnails: %v", p)
		}
	}
	if len(scales) != 8 || scales[0] != "0.1" {
		t.Errorf("scales announced %v", scales)
	}
	_, body = call(t, srv, "GET", base+"/thumbnails/manifest.json", "")
	var master struct {
		ThumbWidth, ThumbHeight int
		ScalesReady             []string
	}
	json.Unmarshal([]byte(body), &master)
	if master.ThumbWidth != 142 || master.ThumbHeight != 80 || len(master.ScalesReady) != 8 {
		t.Errorf("master manifest: %s", body)
	}
	_, body = call(t, srv, "GET", base+"/thumbnails/0.01/manifest.json", "")
	var scale struct {
		TotalThumbs int
		Tiles       []string
	}
	json.Unmarshal([]byte(body), &scale)
	// The MKV lasts a little over 25 s: one frame every 0.5 s is 51 frames.
	if scale.TotalThumbs != 51 || len(scale.Tiles) != 1 {
		t.Errorf("scale 0.01 manifest: %s", body)
	}
	for _, path := range []string{"/thumbnails/0.01/tile_0.webp", "/thumbnails/12.50"} {
		res, err := http.Get(srv.URL + base + path)
		if err != nil {
			t.Fatal(err)
		}
		img, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 || res.Header.Get("Content-Type") != "image/webp" || len(img) == 0 {
			t.Errorf("%s: status %d, %s, %d bytes", path, res.StatusCode, res.Header.Get("Content-Type"), len(img))
		}
	}
	for _, bad := range []string{"/thumbnails/%2E%2E/manifest.json", "/thumbnails/abc", "/thumbnails/0.01/%2E%2E"} {
		if status, _ := call(t, srv, "GET", base+bad, ""); status != 404 {
			t.Errorf("GET %s: status %d, want 404", bad, status)
		}
	}

	// The muted copy has no audio track; the small one is 156 px high.
	probe := func(path string) string {
		out, _ := exec.Command("ffprobe", "-v", "error", "-show_entries", "stream=codec_type,height",
			"-of", "csv=p=0", srv.URL+base+path).Output()
		return strings.Join(strings.Fields(string(out)), " ")
	}
	if got := probe("/file"); got != "video,360" {
		t.Errorf("video streams %q", got)
	}
	if out, _ := exec.Command("ffprobe", "-v", "error", "-show_entries", "stream=codec_name", "-of", "csv=p=0",
		srv.URL+base+"/file").Output(); strings.TrimSpace(string(out)) != "h264" {
		t.Errorf("video codec %q, want h264", out)
	}
	if got := probe("/small"); got != "video,156" {
		t.Errorf("small video streams %q", got)
	}
	if _, err := os.Stat(filepath.Join(root, ws.UUID, "originalWithAudio.mp4")); err != nil {
		t.Errorf("original must be preserved after conversion: %v", err)
	}

	if status, _ := call(t, srv, "DELETE", base, ""); status != 200 {
		t.Errorf("delete: status %d", status)
	}
	for _, path := range []string{"", "/file", "/thumbnails/manifest.json"} {
		if status, _ := call(t, srv, "GET", base+path, ""); status != 404 {
			t.Errorf("GET %q after delete: status %d, want 404", path, status)
		}
	}
}

func TestSceneDetect(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	srv, root := newTestServer(t)
	_, body := call(t, srv, "POST", "/api/v1/workspaces", `{"title":"Cuts"}`)
	var ws struct{ UUID string }
	json.Unmarshal([]byte(body), &ws)
	base := "/api/v1/workspaces/" + ws.UUID

	if status, _ := call(t, srv, "POST", base+"/video/scene-detect", `{}`); status != 404 {
		t.Errorf("without a video: status %d, want 404", status)
	}
	// Red, green, blue: cuts at 2 s and 4 s.
	err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=red:s=640x360:r=25:d=2",
		"-f", "lavfi", "-i", "color=green:s=640x360:r=25:d=2", "-f", "lavfi", "-i", "color=blue:s=640x360:r=25:d=2",
		"-filter_complex", "[0][1][2]concat=n=3", "-c:v", "libx264", "-pix_fmt", "yuv420p",
		filepath.Join(root, ws.UUID, "video.mp4")).Run()
	if err != nil {
		t.Fatal(err)
	}
	events := eventStream(t, srv.URL+base+"/events")
	waitEvent(t, events, "connected")
	status, body := call(t, srv, "POST", base+"/video/scene-detect", `{}`)
	var started struct{ JobID string }
	json.Unmarshal([]byte(body), &started)
	if status != 200 || started.JobID == "" {
		t.Fatalf("start: %d %s", status, body)
	}
	p := waitEvent(t, events, "job:completed")
	got, _ := json.Marshal(p["scenes"])
	want := `[{"score":27,"time":2,"type":"cut"},{"score":27,"time":4,"type":"cut"}]`
	if p["jobId"] != started.JobID || p["type"] != "scene-detect" || p["status"] != "completed" || string(got) != want {
		t.Errorf("event: %v, scenes %s, want %s", p, got, want)
	}
	if status, _ := call(t, srv, "POST", base+"/video/scene-detect", `{"threshold":-1}`); status != 400 {
		t.Errorf("negative threshold: status %d, want 400", status)
	}
}
