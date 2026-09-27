//go:build ios

package main

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func chooseWorkspacePath() (string, error) {
	return "", errors.New("this iOS preview uses a private notebook; linked folders are not available yet")
}

func openInitialWorkspace(s *workspace.Service) error {
	root := application.IOS.StoragePath()
	if root == "" {
		return errors.New("iOS did not provide an app storage directory")
	}
	folder := filepath.Join(root, "Notebook")
	if _, err := os.Stat(folder); errors.Is(err, os.ErrNotExist) {
		if err := os.MkdirAll(folder, 0700); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(folder, "Welcome.org"), []byte("#+TITLE: Welcome to OrbitalNote\n\n* Your iOS preview notebook\nNotes live in private app storage. Uninstalling deletes the local notebook.\nConnect encrypted Sync in Settings to bring your notes to this device.\n"), 0600); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	_, err := s.Open(folder)
	return err
}
