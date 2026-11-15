package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bartoval/audio_video_editor/server/internal/events"
	"github.com/bartoval/audio_video_editor/server/internal/library"
	"github.com/bartoval/audio_video_editor/server/internal/separation"
	"github.com/bartoval/audio_video_editor/server/internal/upload"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

func newTestServer(t *testing.T) (*httptest.Server, string) {
	return newTestServerWith(t, fakeEngine{})
}

// newTestServerWith starts the API in front of a fake Node API, which answers
// "legacy <method> <path>" and streams one thumbnails event on /events.
func newTestServerWith(t *testing.T, engine separation.Engine) (*httptest.Server, string) {
	t.Helper()
	legacy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/events") {
			w.Header().Set("Content-Type", "text/event-stream")
			io.WriteString(w, "event: message\ndata: {\"type\":\"connected\",\"payload\":{}}\n\n: heartbeat\n\n")
			io.WriteString(w, "event: message\ndata: {\"type\":\"thumbnails\",\"payload\":{\"status\":\"ready\"}}\n\n")
			w.(http.Flusher).Flush()
			<-r.Context().Done()
			return
		}
		io.WriteString(w, "legacy "+r.Method+" "+r.URL.Path)
	}))
	t.Cleanup(legacy.Close)
	target, _ := url.Parse(legacy.URL)

	root := t.TempDir()
	store, err := workspace.New(root)
	if err != nil {
		t.Fatal(err)
	}
	uploads, err := upload.NewReceiver(filepath.Join(t.TempDir(), "chunks"), 1<<30)
	if err != nil {
		t.Fatal(err)
	}
	hub := events.NewHub()
	lib := library.New(store)
	srv := httptest.NewServer(New(Config{
		Workspaces: store, Library: lib, Uploads: uploads, Events: hub, LegacyAPI: target,
		Stems: separation.New(t.Context(), engine, store, lib, StemsDone(hub)),
	}))
	t.Cleanup(srv.Close)
	return srv, root
}

func call(t *testing.T, srv *httptest.Server, method, path, body string) (int, string) {
	t.Helper()
	req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	return res.StatusCode, strings.TrimSpace(string(data))
}

func TestRouting(t *testing.T) {
	srv, _ := newTestServer(t)
	for _, tc := range []struct{ method, path, want string }{
		{"GET", "/api/v1/workspaces/x/video", "legacy GET /api/v1/workspaces/x/video"},
		{"GET", "/api/v1/workspaces/x/audio/a/stretch", "legacy GET /api/v1/workspaces/x/audio/a/stretch"},
		{"GET", "/api/v1/workspaces/x", "legacy GET /api/v1/workspaces/x"},
		{"POST", "/api/v1/health", "legacy POST /api/v1/health"},
	} {
		if _, got := call(t, srv, tc.method, tc.path, ""); got != tc.want {
			t.Errorf("%s %s: got %q, want %q", tc.method, tc.path, got, tc.want)
		}
	}
	if status, _ := call(t, srv, "GET", "/api/v1/health", ""); status != http.StatusOK {
		t.Errorf("health: status %d, want 200", status)
	}
}

func TestWorkspaceLifecycle(t *testing.T) {
	srv, root := newTestServer(t)

	if status, body := call(t, srv, "GET", "/api/v1/workspaces", ""); status != 200 || body != "[]" {
		t.Fatalf("empty list: %d %s", status, body)
	}
	if status, _ := call(t, srv, "POST", "/api/v1/workspaces", `{"title":""}`); status != 400 {
		t.Errorf("empty title: status %d, want 400", status)
	}

	status, body := call(t, srv, "POST", "/api/v1/workspaces", `{"title":"Song"}`)
	var created struct{ UUID string }
	json.Unmarshal([]byte(body), &created)
	if status != 201 || created.UUID == "" {
		t.Fatalf("create: %d %s", status, body)
	}
	if _, err := os.Stat(filepath.Join(root, created.UUID, "library")); err != nil {
		t.Errorf("create: %v", err)
	}

	state := "/api/v1/workspaces/" + created.UUID + "/state"
	if _, body := call(t, srv, "GET", state, ""); body != "{}" {
		t.Errorf("initial state: %s", body)
	}
	// Key order and number formatting must survive the round trip.
	saved := `{"z":1,"a":[0.10,2e3],"t":"x"}`
	if status, _ := call(t, srv, "PUT", state, saved); status != 200 {
		t.Errorf("save state: status %d", status)
	}
	if _, body := call(t, srv, "GET", state, ""); strings.Join(strings.Fields(body), "") != saved {
		t.Errorf("load state: got %s, want %s", body, saved)
	}
	if status, _ := call(t, srv, "PUT", state, `{broken`); status != 400 {
		t.Errorf("invalid state: status %d, want 400", status)
	}
	if status, _ := call(t, srv, "PUT", "/api/v1/workspaces/missing/state", `{}`); status != 404 {
		t.Errorf("state of missing workspace: status %d, want 404", status)
	}

	if status, _ := call(t, srv, "DELETE", "/api/v1/workspaces/"+created.UUID, ""); status != 200 {
		t.Errorf("delete: status %d", status)
	}
	if _, err := os.Stat(filepath.Join(root, created.UUID)); !os.IsNotExist(err) {
		t.Errorf("delete left the folder: %v", err)
	}
	if status, _ := call(t, srv, "DELETE", "/api/v1/workspaces/"+created.UUID, ""); status != 404 {
		t.Errorf("second delete: status %d, want 404", status)
	}
	// The mux cleans a literal "..", but an escaped one reaches the handler.
	for _, uuid := range []string{"%2E%2E", "a%2Fb"} {
		if status, _ := call(t, srv, "DELETE", "/api/v1/workspaces/"+uuid, ""); status != 404 {
			t.Errorf("delete %s: status %d, want 404", uuid, status)
		}
	}
	if _, err := os.Stat(root); err != nil {
		t.Errorf("root removed: %v", err)
	}
}
