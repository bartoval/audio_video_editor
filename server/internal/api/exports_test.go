package api

import (
	"encoding/json"
	"fmt"
	"math"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/bartoval/audio_video_editor/server/internal/media"
)

func TestExport(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	srv, root := newTestServer(t)
	_, body := call(t, srv, "POST", "/api/v1/workspaces", `{"title":"Mix"}`)
	var ws struct{ UUID string }
	json.Unmarshal([]byte(body), &ws)
	base := "/api/v1/workspaces/" + ws.UUID

	tone := func(freq int, name string) string {
		wav, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i",
			fmt.Sprintf("sine=frequency=%d:duration=3:sample_rate=44100", freq), "-ac", "2", "-f", "wav", "pipe:1").Output()
		if err != nil {
			t.Fatal(err)
		}
		return uploadChunk(t, srv.URL+base+"/audio", name, name+".wav", wav, 1, len(wav))["file"].(string)
	}
	low, high := tone(440, "low"), tone(660, "high")

	// low at half gain from 0 s; high from 4 s, stretched to 6 s, panned right.
	timeline := fmt.Sprintf(`{"duration":10,"format":"wav","tracks":[
		{"idTrack":%q,"startTime":0,"gain":0.5},
		{"idTrack":%q,"startTime":4,"stretchFactor":2,"pitch":0,"panValue":1}]}`, low, high)
	status, body := call(t, srv, "POST", base+"/exports", timeline)
	var res struct{ Res, Type, Format string }
	json.Unmarshal([]byte(body), &res)
	if status != 200 || res.Type != "audio" || res.Format != "wav" || res.Res != base+"/exports/audio.wav" {
		t.Fatalf("audio export: %d %s", status, body)
	}
	audio, err := media.DecodeStereo(t.Context(), srv.URL+res.Res, 44100)
	if err != nil {
		t.Fatal(err)
	}
	peak := func(c int, from, to float64) float64 {
		p := 0.0
		for _, v := range audio[c][int(from*44100):int(to*44100)] {
			p = max(p, math.Abs(float64(v)))
		}
		return p
	}
	// lavfi sine has amplitude 1/8; made stereo, its centre goes to each side at -3 dB.
	src := 0.125 / math.Sqrt2
	if got := float64(len(audio[0])) / 44100; math.Abs(got-10) > 0.05 {
		t.Errorf("length %.2f s, want 10", got)
	}
	if p := peak(0, 0.5, 2.5); math.Abs(p-src/2) > 0.001 {
		t.Errorf("half-gain track peak %.4f, want %.4f", p, src/2)
	}
	if p := peak(0, 3.2, 3.9); p > 0.001 {
		t.Errorf("silence between the tracks: peak %.4f", p)
	}
	if l, r := peak(0, 5, 9), peak(1, 5, 9); l > 0.001 || r < src*0.9 {
		t.Errorf("panned right track: left %.4f right %.4f", l, r)
	}
	if p := peak(1, 9.7, 9.95); p < src*0.9 {
		t.Errorf("stretched track ends early: peak %.4f at 9.7-9.95 s", p)
	}

	for _, bad := range []string{
		`{"duration":5,"tracks":[{"idTrack":-1}]}`,
		`{"duration":5,"tracks":[]}`,
		`{"duration":0,"tracks":[{"idTrack":"x"}]}`,
		fmt.Sprintf(`{"duration":5,"tracks":[{"idTrack":%q,"stretchFactor":0}]}`, low),
	} {
		if status, body := call(t, srv, "POST", base+"/exports", bad); status != 400 {
			t.Errorf("%s: %d %s, want 400", bad, status, body)
		}
	}
	if status, _ := call(t, srv, "GET", base+"/exports/out", ""); status != 404 {
		t.Errorf("video not exported yet: status %d, want 404", status)
	}

	// With a video, the mix becomes its audio; the video stream is copied.
	video := filepath.Join(root, ws.UUID, "video.mp4")
	if err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=4",
		"-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", video).Run(); err != nil {
		t.Fatal(err)
	}
	status, body = call(t, srv, "POST", base+"/exports", fmt.Sprintf(`{"duration":4,"tracks":[{"idTrack":%q}]}`, low))
	json.Unmarshal([]byte(body), &res)
	if status != 200 || res.Type != "video" || res.Res != base+"/exports/out" {
		t.Fatalf("video export: %d %s", status, body)
	}
	out, _ := exec.Command("ffprobe", "-v", "error", "-show_entries", "stream=codec_name:format=duration",
		"-of", "csv=p=0", srv.URL+res.Res).Output()
	fields := strings.Fields(string(out))
	if len(fields) != 3 || fields[0] != "h264" || fields[1] != "aac" {
		t.Fatalf("exported video streams %q", out)
	}
	if d, _ := strconv.ParseFloat(fields[2], 64); math.Abs(d-4) > 0.1 {
		t.Errorf("exported video lasts %.2f s, want 4", d)
	}
}
