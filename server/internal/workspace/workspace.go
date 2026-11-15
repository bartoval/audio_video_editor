// Package workspace manages the workspaces on disk. The layout is shared
// with the legacy Node API:
//
//	<root>/projects.json             list of workspaces
//	<root>/<uuid>/trackList.json     audio library
//	<root>/<uuid>/saved/backup.json  editor state
//	<root>/<uuid>/library/ ...       media folders
package workspace

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sync"

	"github.com/bartoval/audio_video_editor/server/internal/files"
)

var (
	// ErrNotFound is returned when a workspace does not exist.
	ErrNotFound = errors.New("project not found")
	// ErrInvalid is returned for malformed input.
	ErrInvalid = errors.New("invalid input")
)

// Workspace is an entry of projects.json.
type Workspace struct {
	UUID          string `json:"uuid"`
	Title         string `json:"title"`
	IsVideoLoaded bool   `json:"isVideoLoaded"`
}

// Store reads and writes the workspaces under one root directory.
type Store struct {
	root string
	mu   sync.Mutex // serializes changes to projects.json
}

// New returns a store rooted at dir and creates the directory if needed.
func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{root: dir}, nil
}

// Root is the directory that holds the workspaces.
func (s *Store) Root() string { return s.root }

var validUUID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// Dir returns the folder of an existing workspace. The uuid comes from the
// URL, so anything that is not a plain identifier is rejected as not found.
func (s *Store) Dir(uuid string) (string, error) {
	if !validUUID.MatchString(uuid) {
		return "", notFound(uuid)
	}
	list, err := s.List()
	if err != nil {
		return "", err
	}
	if !slices.ContainsFunc(list, func(w Workspace) bool { return w.UUID == uuid }) {
		return "", notFound(uuid)
	}
	return filepath.Join(s.root, uuid), nil
}

// List returns all workspaces in creation order.
func (s *Store) List() ([]Workspace, error) {
	var data struct {
		Projects []Workspace `json:"projects"`
	}
	err := files.ReadJSON(filepath.Join(s.root, "projects.json"), &data)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	if data.Projects == nil {
		data.Projects = []Workspace{}
	}
	return data.Projects, nil
}

func notFound(uuid string) error { return fmt.Errorf("%w: %s", ErrNotFound, uuid) }

// Create adds a workspace with a new random uuid and creates its folders.
func (s *Store) Create(title string) (Workspace, error) {
	return s.create(title, newUUID())
}

// Ensure creates a locally chosen workspace id without resetting an existing library.
func (s *Store) Ensure(title, uuid string) (Workspace, error) {
	if title == "" || !validUUID.MatchString(uuid) {
		return Workspace{}, ErrInvalid
	}
	return s.create(title, uuid)
}

// EnsureDefault creates the "Default" workspace (uuid "0") when there is none.
func (s *Store) EnsureDefault() error {
	list, err := s.List()
	if err != nil || len(list) > 0 {
		return err
	}
	_, err = s.create("Default", "0")
	return err
}

func (s *Store) create(title, uuid string) (Workspace, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, err := s.List()
	if err != nil {
		return Workspace{}, err
	}
	for _, existing := range list {
		if existing.UUID == uuid {
			return existing, nil
		}
	}
	// Folders first: a listed workspace always has them.
	if err := initFolders(filepath.Join(s.root, uuid)); err != nil {
		return Workspace{}, err
	}
	w := Workspace{UUID: uuid, Title: title}
	return w, s.save(append(list, w))
}

func initFolders(dir string) error {
	for _, sub := range []string{"resources/videoTracks", "resources/audioTracks", "thumbs", "library", "saved", "published"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o755); err != nil {
			return err
		}
	}
	// A struct keeps the key order of the files written by the Node API.
	type order struct {
		Duration string `json:"duration"`
		Name     string `json:"name"`
	}
	type filter struct {
		Name string `json:"name"`
		Sort order  `json:"sort"`
		Page int    `json:"page"`
	}
	trackList := struct {
		Tracks map[string]any `json:"tracks"`
		Filter filter         `json:"filter"`
	}{map[string]any{}, filter{Sort: order{"desc", "desc"}, Page: 1}}
	return files.WriteJSON(filepath.Join(dir, "trackList.json"), trackList)
}

// Delete removes a workspace and all its files.
func (s *Store) Delete(uuid string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, err := s.List()
	if err != nil {
		return err
	}
	i := slices.IndexFunc(list, func(w Workspace) bool { return w.UUID == uuid })
	if i < 0 || !validUUID.MatchString(uuid) {
		return notFound(uuid)
	}
	if err := s.save(slices.Delete(list, i, i+1)); err != nil {
		return err
	}
	return os.RemoveAll(filepath.Join(s.root, uuid))
}

func (s *Store) save(list []Workspace) error {
	return files.WriteJSON(filepath.Join(s.root, "projects.json"), map[string]any{"projects": list})
}

// LoadState returns the saved editor state, or {} if nothing valid was saved.
func (s *Store) LoadState(uuid string) ([]byte, error) {
	dir, err := s.Dir(uuid)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(dir, "saved", "backup.json"))
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	if !json.Valid(data) {
		return []byte("{}"), nil
	}
	return data, nil
}

// SaveState stores the editor state exactly as sent by the frontend.
func (s *Store) SaveState(uuid string, state []byte) error {
	dir, err := s.Dir(uuid)
	if err != nil {
		return err
	}
	if !json.Valid(state) {
		return fmt.Errorf("%w: state is not valid JSON", ErrInvalid)
	}
	if err := os.MkdirAll(filepath.Join(dir, "saved"), 0o755); err != nil {
		return err
	}
	return files.Write(filepath.Join(dir, "saved", "backup.json"), state)
}

// newUUID returns a random version 4 UUID.
func newUUID() string {
	var b [16]byte
	rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
