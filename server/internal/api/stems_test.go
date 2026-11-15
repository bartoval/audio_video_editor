package api

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os/exec"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/bartoval/steammeros/stems"
)

// fakeEngine splits the input into four stems scaled by 1/4.
type fakeEngine struct{ err error }

func (f fakeEngine) Separate(_ context.Context, audio [][]float32, _ int, _ func(float64)) ([]stems.Stem, error) {
	if f.err != nil {
		return nil, f.err
	}
	var out []stems.Stem
	for _, name := range []string{"drums", "bass", "other", "vocals"} {
		chans := make([][]float32, len(audio))
		for c := range audio {
			chans[c] = make([]float32, len(audio[c]))
			for i, v := range audio[c] {
				chans[c][i] = v / 4
			}
		}
		out = append(out, stems.Stem{Name: name, Channels: chans})
	}
	return out, nil
}

// eventStream opens /events and returns the "type" and payload of each message.
func eventStream(t *testing.T, url string) <-chan map[string]any {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatalf("events content type %q", res.Header.Get("Content-Type"))
	}
	out := make(chan map[string]any, 16)
	go func() {
		defer res.Body.Close()
		scanner := bufio.NewScanner(res.Body)
		for scanner.Scan() {
			if data, ok := strings.CutPrefix(scanner.Text(), "data: "); ok {
				var msg map[string]any
				json.Unmarshal([]byte(data), &msg)
				out <- msg
			}
		}
	}()
	return out
}

func waitEvent(t *testing.T, ch <-chan map[string]any, typ string) map[string]any {
	t.Helper()
	timeout := time.After(10 * time.Second)
	for {
		select {
		case msg := <-ch:
			if msg["type"] == typ {
				payload, _ := msg["payload"].(map[string]any)
				return payload
			}
		case <-timeout:
			t.Fatalf("no %q event", typ)
		}
	}
}

func TestStems(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	for _, failing := range []bool{false, true} {
		var engine fakeEngine
		if failing {
			engine.err = errors.New("out of memory")
		}
		srv, _ := newTestServerWith(t, engine)
		_, body := call(t, srv, "POST", "/api/v1/workspaces", `{"title":"Song"}`)
		var ws struct{ UUID string }
		json.Unmarshal([]byte(body), &ws)
		base := "/api/v1/workspaces/" + ws.UUID

		mp3, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
			"-ac", "1", "-f", "mp3", "pipe:1").Output()
		if err != nil {
			t.Fatal(err)
		}
		id := uploadChunk(t, srv.URL+base+"/audio", "s1", "tune.mp3", mp3, 1, len(mp3))["file"].(string)

		events := eventStream(t, srv.URL+base+"/events")
		waitEvent(t, events, "connected")
		// Events still emitted by the Node API arrive on the same stream.
		if p := waitEvent(t, events, "thumbnails"); p["status"] != "ready" {
			t.Errorf("relayed thumbnails event: %v", p)
		}

		status, body := call(t, srv, "POST", base+"/audio/"+id+"/stems", `{}`)
		var started struct{ JobID string }
		json.Unmarshal([]byte(body), &started)
		if status != 200 || started.JobID == "" {
			t.Fatalf("start: %d %s", status, body)
		}
		done := waitEvent(t, events, "job:completed")
		if done["jobId"] != started.JobID || done["audioId"] != id || done["type"] != "stems" {
			t.Fatalf("completion event: %v", done)
		}
		download := srv.URL + base + "/audio/" + id + "/stems/" + started.JobID + "/download"
		res, err := http.Get(download)
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(res.Body)
		res.Body.Close()

		if failing {
			if done["status"] != "failed" || done["error"] != "out of memory" || res.StatusCode != 400 {
				t.Errorf("failed job: event %v, download status %d", done, res.StatusCode)
			}
			continue
		}
		if done["status"] != "completed" || res.StatusCode != 200 {
			t.Fatalf("job: event %v, download status %d %s", done, res.StatusCode, data)
		}
		zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			t.Fatal(err)
		}
		track := strings.TrimSuffix(id, ".mp3")
		var names []string
		for _, f := range zr.File {
			names = append(names, f.Name)
			r, _ := f.Open()
			wav, _ := io.ReadAll(r)
			channels := binary.LittleEndian.Uint16(wav[22:])
			rate := binary.LittleEndian.Uint32(wav[24:])
			frames := binary.LittleEndian.Uint32(wav[40:]) / 4
			// An MP3 piped from ffmpeg has no gapless header: encoder padding stays in.
			if string(wav[:4]) != "RIFF" || channels != 2 || rate != 44100 || frames < 44100 || frames > 48000 {
				t.Errorf("%s: %d channels, %d Hz, %d frames", f.Name, channels, rate, frames)
			}
		}
		slices.Sort(names)
		want := []string{track + "_bass.wav", track + "_drums.wav", track + "_other.wav", track + "_vocals.wav"}
		if !slices.Equal(names, want) {
			t.Errorf("zip entries %v, want %v", names, want)
		}
		if !strings.Contains(res.Header.Get("Content-Disposition"), track+"_stems.zip") {
			t.Errorf("Content-Disposition %q", res.Header.Get("Content-Disposition"))
		}
		if status, _ := call(t, srv, "GET", base+"/audio/"+id+"/stems/"+strings.Repeat("0", 32)+"/download", ""); status != 400 {
			t.Errorf("unknown job: status %d, want 400", status)
		}
	}
}
