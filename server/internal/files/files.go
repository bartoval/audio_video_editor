// Package files writes files so that a crash never leaves them half written.
package files

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// WriteJSON writes v indented by two spaces, like the Node API.
func WriteJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return Write(path, data)
}

// Write replaces path atomically.
func Write(path string, data []byte) error {
	tmp, err := Temp(path)
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// Temp creates an empty file next to path, readable like a normal file.
// Renaming it onto path publishes it atomically.
func Temp(path string) (*os.File, error) {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*"+filepath.Ext(path))
	if err != nil {
		return nil, err
	}
	if err := tmp.Chmod(0o644); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return nil, err
	}
	return tmp, nil
}

// ReadJSON decodes the JSON file at path into v.
func ReadJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}
