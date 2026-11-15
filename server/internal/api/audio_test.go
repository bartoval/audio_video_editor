package api

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"testing"
)

// uploadChunk posts one chunk the way ChunkedUploader does.
func uploadChunk(t *testing.T, url, id, name string, data []byte, number int, chunkSize int) map[string]any {
	t.Helper()
	start := (number - 1) * chunkSize
	end := min(start+chunkSize, len(data))
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	part, _ := form.CreateFormFile("file", name)
	part.Write(data[start:end])
	for k, v := range map[string]string{
		"flowChunkNumber": strconv.Itoa(number), "flowChunkSize": strconv.Itoa(chunkSize),
		"flowTotalSize": strconv.Itoa(len(data)), "flowIdentifier": id, "flowFilename": name,
		"project_uuid": "0", "provider": "test",
	} {
		form.WriteField(k, v)
	}
	form.Close()
	res, err := http.Post(url, form.FormDataContentType(), &body)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var out map[string]any
	json.NewDecoder(res.Body).Decode(&out)
	if res.StatusCode != 200 {
		t.Fatalf("chunk %d: status %d %v", number, res.StatusCode, out)
	}
	return out
}

func TestAudioLibrary(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	srv, _ := newTestServer(t)
	_, body := call(t, srv, "POST", "/api/v1/workspaces", `{"title":"Song"}`)
	var ws struct{ UUID string }
	json.Unmarshal([]byte(body), &ws)
	base := srv.URL + "/api/v1/workspaces/" + ws.UUID + "/audio"

	wav, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
		"-ac", "2", "-f", "wav", "pipe:1").Output()
	if err != nil {
		t.Fatal(err)
	}
	const chunk = 100_000
	chunks := (len(wav) + chunk - 1) / chunk

	// Out of order, with a retried chunk: only the last new chunk completes the file.
	order := []int{2, 1, 1}
	for n := 3; n <= chunks; n++ {
		order = append(order, n)
	}
	var last map[string]any
	for i, n := range order {
		last = uploadChunk(t, base, "up-1", "My Song!.wav", wav, n, chunk)
		if done := last["status"] == "complete"; done != (i == len(order)-1) {
			t.Fatalf("chunk %d (#%d): status %v", n, i, last["status"])
		}
	}
	id := last["file"].(string)
	meta := last["metadata"].(map[string]any)
	if !strings.HasPrefix(id, "My_Song_-") || meta["sampleRate"] != 44100.0 || meta["provider"] != "test" ||
		meta["durationFormatted"] != "00:03.00" || meta["fileSize"] != float64(len(wav)) {
		t.Errorf("metadata: %s %v", id, meta)
	}

	// The same content again is reported as a duplicate of the first file.
	for n := 1; n <= chunks; n++ {
		last = uploadChunk(t, base, "up-2", "copy.wav", wav, n, chunk)
	}
	if last["status"] != "duplicate" || last["file"] != id {
		t.Errorf("duplicate: %v", last)
	}

	if _, body := call(t, srv, "GET", "/api/v1/workspaces/"+ws.UUID+"/audio", ""); !strings.Contains(body, id) {
		t.Errorf("list: %s", body)
	}

	req, _ := http.NewRequest("GET", base+"/"+id, nil)
	req.Header.Set("Range", "bytes=0-99")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 206 || !bytes.Equal(got, wav[:100]) || res.Header.Get("ETag") == "" {
		t.Errorf("range: status %d, %d bytes", res.StatusCode, len(got))
	}

	res, err = http.Get(base + "/" + id + "/file?format=mp3")
	if err != nil {
		t.Fatal(err)
	}
	mp3, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "audio/mpeg" || len(mp3) == 0 ||
		!strings.Contains(res.Header.Get("Content-Disposition"), ".mp3") {
		t.Errorf("mp3 download: status %d, %d bytes, %v", res.StatusCode, len(mp3), res.Header)
	}

	// Stretch the second half of the file to twice its length.
	status, body := call(t, srv, "POST", base[len(srv.URL):]+"/"+id+"/stretch",
		`{"audioId":"x","ratio":"2.0","pitchValue":0,"startTime":1.5,"duration":1.5}`)
	var stretched struct {
		OutputID, URL string
		Cached        bool
	}
	json.Unmarshal([]byte(body), &stretched)
	if status != 200 || stretched.Cached {
		t.Fatalf("stretch: %d %s", status, body)
	}
	res, err = http.Get(srv.URL + stretched.URL)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Errorf("derived: status %d", res.StatusCode)
	}
	out, _ := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration",
		"-of", "csv=p=0", srv.URL+stretched.URL).Output()
	if d, _ := strconv.ParseFloat(strings.TrimSpace(string(out)), 64); d < 2.9 || d > 3.2 {
		t.Errorf("stretched duration %v, want ~3 s", d)
	}
	if _, body := call(t, srv, "POST", base[len(srv.URL):]+"/"+id+"/stretch",
		`{"ratio":"2.0","pitchValue":0,"startTime":1.5,"duration":1.5}`); !strings.Contains(body, `"cached":true`) {
		t.Errorf("second stretch not cached: %s", body)
	}
	if status, _ := call(t, srv, "POST", base[len(srv.URL):]+"/"+id+"/stretch", `{"ratio":"11"}`); status != 400 {
		t.Errorf("ratio 11: status %d, want 400", status)
	}

	for _, bad := range []string{"%2E%2E", "derived", "cache"} {
		if status, _ := call(t, srv, "GET", base[len(srv.URL):]+"/"+bad, ""); status != 404 {
			t.Errorf("GET %s: status %d, want 404", bad, status)
		}
	}

	if status, _ := call(t, srv, "DELETE", base[len(srv.URL):]+"/"+id, ""); status != 200 {
		t.Errorf("delete: status %d", status)
	}
	if _, body := call(t, srv, "GET", base[len(srv.URL):], ""); body != "{}" {
		t.Errorf("list after delete: %s", body)
	}
}
