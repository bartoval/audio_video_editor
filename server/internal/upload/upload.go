// Package upload reassembles files sent in chunks by the frontend
// (ChunkedUploader). Each chunk is written at its offset in a single file, so
// the upload is complete as soon as the last chunk lands, without a final
// concatenation pass.
package upload

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ErrInvalid is returned for chunks with missing or inconsistent parameters.
var ErrInvalid = errors.New("invalid chunk")

// Chunk is one part of an upload.
type Chunk struct {
	ID        string // same for all chunks of a file
	Number    int    // 1-based
	ChunkSize int64  // size of every chunk except the last
	TotalSize int64
	Data      io.Reader
}

// Receiver collects chunks in a temporary directory.
type Receiver struct {
	dir     string
	maxSize int64

	mu      sync.Mutex
	pending map[string]*pending
}

type pending struct {
	received map[int]bool
	total    int
	updated  time.Time
}

// NewReceiver stores partial uploads in dir and rejects files larger than maxSize.
func NewReceiver(dir string, maxSize int64) (*Receiver, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Receiver{dir: dir, maxSize: maxSize, pending: map[string]*pending{}}, nil
}

var validID = regexp.MustCompile(`^[A-Za-z0-9._-]{1,200}$`)

// Result tells whether a chunk completed its file.
type Result struct {
	Total int    // number of chunks of the file
	Path  string // assembled file once Done; it then belongs to the caller
	Done  bool
}

// Add writes a chunk at its offset.
func (r *Receiver) Add(c Chunk) (Result, error) {
	if !validID.MatchString(c.ID) || strings.Contains(c.ID, "..") {
		return Result{}, fmt.Errorf("%w: identifier", ErrInvalid)
	}
	if c.ChunkSize <= 0 || c.TotalSize <= 0 || c.TotalSize > r.maxSize {
		return Result{}, fmt.Errorf("%w: size", ErrInvalid)
	}
	res := Result{Total: int((c.TotalSize + c.ChunkSize - 1) / c.ChunkSize)}
	if c.Number < 1 || c.Number > res.Total {
		return Result{}, fmt.Errorf("%w: chunk number", ErrInvalid)
	}
	offset := int64(c.Number-1) * c.ChunkSize
	size := min(c.ChunkSize, c.TotalSize-offset)

	path := filepath.Join(r.dir, "flow-"+c.ID+".part")
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0o644)
	if err != nil {
		return Result{}, err
	}
	n, err := io.Copy(io.NewOffsetWriter(f, offset), io.LimitReader(c.Data, size+1))
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return Result{}, err
	}
	if n != size {
		return Result{}, fmt.Errorf("%w: chunk %d has %d bytes, want %d", ErrInvalid, c.Number, n, size)
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	p := r.pending[c.ID]
	if p == nil {
		p = &pending{received: map[int]bool{}, total: res.Total}
		r.pending[c.ID] = p
	}
	p.received[c.Number] = true
	p.updated = time.Now()
	if len(p.received) == p.total {
		delete(r.pending, c.ID)
		res.Path, res.Done = path, true
	}
	return res, nil
}

// Clean removes uploads untouched for longer than ttl. Call it periodically.
func (r *Receiver) Clean(ttl time.Duration) {
	cutoff := time.Now().Add(-ttl)

	r.mu.Lock()
	for id, p := range r.pending {
		if p.updated.Before(cutoff) {
			delete(r.pending, id)
		}
	}
	r.mu.Unlock()

	entries, _ := os.ReadDir(r.dir)
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".part") {
			continue
		}
		if info, err := e.Info(); err == nil && info.ModTime().Before(cutoff) {
			os.Remove(filepath.Join(r.dir, e.Name()))
		}
	}
}
