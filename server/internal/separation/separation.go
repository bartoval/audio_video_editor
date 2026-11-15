// Package separation splits library tracks into stems (drums, bass, other,
// vocals) with steammeros. Jobs run one at a time, in arrival order: a
// separation fills the GPU (or every CPU core) by itself.
//
// The stems of a job are kept in <workspace>/stems/<job id>/<stem>.wav; the
// folder appears only once all stems are written.
package separation

import (
	"archive/zip"
	"bufio"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/bartoval/steammeros/stems"

	"github.com/bartoval/audio_video_editor/server/internal/library"
	"github.com/bartoval/audio_video_editor/server/internal/media"
	"github.com/bartoval/audio_video_editor/server/internal/workspace"
)

var (
	// ErrBusy is returned when too many jobs are waiting.
	ErrBusy = errors.New("too many stem separations queued")
	// ErrNotReady is returned for a job that is still running, failed or unknown.
	ErrNotReady = errors.New("stems not ready")
)

const sampleRate = 44100

// Engine separates audio; *stems.Engine implements it.
type Engine interface {
	Separate(ctx context.Context, audio [][]float32, sampleRate int, progress func(float64)) ([]stems.Stem, error)
	Close() error
}

// OpenEngine loads the model.
type OpenEngine func() (Engine, error)

// Result is reported when a job ends: Err is nil on success.
type Result struct {
	UUID, AudioID, JobID string
	Stems                []string
	Err                  error
}

// Service queues and runs separation jobs.
//
// The model is loaded when a job arrives and freed once the queue is empty:
// on a GPU, ONNX Runtime keeps the memory of a run (over 6 GB for SCNet) until
// the model is closed, while loading it again takes well under a second.
type Service struct {
	open    OpenEngine
	engine  Engine // nil while idle; used by the worker only
	ws      *workspace.Store
	library *library.Library
	done    func(Result)
	queue   chan job
}

type job struct{ uuid, audioID, id, src string }

// New starts the worker; it stops when ctx ends. done is called after every job.
func New(ctx context.Context, open OpenEngine, ws *workspace.Store, lib *library.Library, done func(Result)) *Service {
	s := &Service{open: open, ws: ws, library: lib, done: done, queue: make(chan job, 32)}
	go s.work(ctx)
	return s
}

// Start queues the separation of a library track and returns the job id.
func (s *Service) Start(uuid, audioID string) (string, error) {
	src, err := s.library.File(uuid, audioID)
	if err != nil {
		return "", err
	}
	j := job{uuid: uuid, audioID: audioID, id: newID(), src: src}
	select {
	case s.queue <- j:
		return j.id, nil
	default:
		return "", ErrBusy
	}
}

func (s *Service) work(ctx context.Context) {
	defer s.release()
	for {
		select {
		case <-ctx.Done():
			return
		case j := <-s.queue:
			started := time.Now()
			names, err := s.run(ctx, j)
			if err != nil {
				slog.Error("stem separation failed", "job", j.id, "audio", j.audioID, "err", err)
			} else {
				slog.Info("stems separated", "job", j.id, "audio", j.audioID, "took", time.Since(started).Round(time.Millisecond))
			}
			s.done(Result{UUID: j.uuid, AudioID: j.audioID, JobID: j.id, Stems: names, Err: err})
			if len(s.queue) == 0 {
				s.release()
			}
		}
	}
}

// release frees the model, and with it the memory of its last run.
func (s *Service) release() {
	if s.engine != nil {
		s.engine.Close()
		s.engine = nil
	}
}

func (s *Service) run(ctx context.Context, j job) ([]string, error) {
	audio, err := media.DecodeStereo(ctx, j.src, sampleRate)
	if err != nil {
		return nil, err
	}
	if len(audio[0]) == 0 {
		return nil, errors.New("no audio in file")
	}
	if s.engine == nil {
		engine, err := s.open()
		if err != nil {
			return nil, fmt.Errorf("load stems model: %w", err)
		}
		s.engine = engine
	}
	parts, err := s.engine.Separate(ctx, audio, sampleRate, nil)
	if err != nil {
		return nil, err
	}

	dir, err := s.ws.Dir(j.uuid)
	if err != nil {
		return nil, err // workspace deleted meanwhile
	}
	final := filepath.Join(dir, "stems", j.id)
	tmp := final + ".tmp"
	if err := os.MkdirAll(tmp, 0o755); err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmp)
	names := make([]string, len(parts))
	for i, p := range parts {
		names[i] = p.Name
		if err := writeWAV(filepath.Join(tmp, p.Name+".wav"), p.Channels); err != nil {
			return nil, err
		}
	}
	return names, os.Rename(tmp, final)
}

var validJobID = regexp.MustCompile(`^[0-9a-f]{32}$`)

// WriteZip writes the stems of a finished job as a zip, with entries named
// <track>_<stem>.wav. WAV barely compresses, so entries are stored as they are.
func (s *Service) WriteZip(w io.Writer, uuid, jobID, trackName string) error {
	dir, err := s.ws.Dir(uuid)
	if err != nil {
		return err
	}
	if !validJobID.MatchString(jobID) {
		return ErrNotReady
	}
	entries, err := os.ReadDir(filepath.Join(dir, "stems", jobID))
	if err != nil {
		return ErrNotReady
	}
	zw := zip.NewWriter(w)
	for _, e := range entries {
		header := &zip.FileHeader{Name: trackName + "_" + e.Name(), Method: zip.Store, Modified: time.Now()}
		dst, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}
		f, err := os.Open(filepath.Join(dir, "stems", jobID, e.Name()))
		if err != nil {
			return err
		}
		_, err = io.Copy(dst, f)
		f.Close()
		if err != nil {
			return err
		}
	}
	return zw.Close()
}

// TrackName is the name used for the files of a track: its id without extension.
func TrackName(audioID string) string {
	return strings.TrimSuffix(filepath.Base(audioID), filepath.Ext(audioID))
}

// writeWAV writes planar float samples as 16-bit PCM, clipping out-of-range values.
func writeWAV(path string, channels [][]float32) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	nch, frames := len(channels), len(channels[0])
	dataSize := uint32(frames * nch * 2)
	w := bufio.NewWriterSize(f, 1<<20)
	header := []any{
		[4]byte{'R', 'I', 'F', 'F'}, 36 + dataSize, [4]byte{'W', 'A', 'V', 'E'},
		[4]byte{'f', 'm', 't', ' '}, uint32(16), uint16(1), uint16(nch),
		uint32(sampleRate), uint32(sampleRate * nch * 2), uint16(nch * 2), uint16(16),
		[4]byte{'d', 'a', 't', 'a'}, dataSize,
	}
	for _, v := range header {
		if err := binary.Write(w, binary.LittleEndian, v); err != nil {
			return err
		}
	}
	var sample [2]byte
	for i := range frames {
		for c := range nch {
			v := math.Round(float64(channels[c][i]) * 32767)
			binary.LittleEndian.PutUint16(sample[:], uint16(int16(max(-32768, min(32767, v)))))
			w.Write(sample[:])
		}
	}
	if err := w.Flush(); err != nil {
		return err
	}
	return f.Close()
}

func newID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
