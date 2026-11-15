package api

import (
	"bytes"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"testing"
)

func TestLocalProjectSync(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	srv, _ := newTestServer(t)
	base := "/api/v1/workspaces/local-project"
	ensure := func() {
		t.Helper()
		if status, body := call(t, srv, "PUT", base, `{"title":"Local project"}`); status != http.StatusOK {
			t.Fatalf("ensure: %d %s", status, body)
		}
	}
	ensure()
	wav, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", "-f", "wav", "pipe:1").Output()
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"audio", "derived"} {
		url := srv.URL + base + "/sync/" + kind + "/stable.wav"
		for _, attempt := range []string{"first", "retry"} {
			uploadChunk(t, url, kind+attempt, "Original.wav", wav, 1, len(wav))
		}
	}
	ensure() // Must not reset the library or replace ids on retry.
	if status, body := call(t, srv, "GET", base+"/audio", ""); status != 200 || strings.Count(body, `"id":"stable.wav"`) != 1 {
		t.Fatalf("library after retry: %d %s", status, body)
	}
	for _, route := range []string{"/audio/stable.wav", "/audio/derived/stable.wav"} {
		res, err := http.Get(srv.URL + base + route)
		if err != nil {
			t.Fatal(err)
		}
		got, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil || res.StatusCode != 200 || !bytes.Equal(got, wav) {
			t.Fatalf("original bytes changed: %s", route)
		}
	}
	state := `{"video":null,"tracks":[{"idTrack":"stable.wav","derivedId":"stable.wav"}]}`
	if status, body := call(t, srv, "PUT", base+"/state", state); status != 200 {
		t.Fatalf("save: %d %s", status, body)
	}
	if _, body := call(t, srv, "GET", base+"/state", ""); body != state {
		t.Fatalf("state changed: %s", body)
	}
	if status, _ := call(t, srv, "PUT", "/api/v1/workspaces/invalid%3Fid", `{"title":"No"}`); status != 400 {
		t.Fatalf("invalid client id accepted: %d", status)
	}
}
