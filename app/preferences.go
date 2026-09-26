package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Host preferences contain only the last selected folder, never note content.
type preferences struct {
	Workspace string `json:"workspace"`
}

func preferencePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "OrbitalNote", "preferences.json"), nil
}
func lastWorkspace() string {
	p, err := preferencePath()
	if err != nil {
		return ""
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	var prefs preferences
	if json.Unmarshal(b, &prefs) != nil {
		return ""
	}
	return prefs.Workspace
}
func rememberWorkspace(folder string) error {
	p, err := preferencePath()
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(p), 0700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(preferences{Workspace: folder}, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(p), ".preferences-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(b); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return os.Rename(f.Name(), p)
}
