package main

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func init() {
	application.RegisterAndroidMain(main)
}

func chooseWorkspacePath() (string, error) {
	return "", errors.New("this Android preview uses its private test notebook; linking a device folder is not implemented yet")
}

func openInitialWorkspace(s *workspace.Service) error {
	root := application.Android.StoragePath()
	if root == "" {
		return errors.New("Android did not provide an app storage directory")
	}
	if err := os.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config")); err != nil {
		return err
	}
	folder := filepath.Join(root, "Test Notebook")
	// Seed only a new notebook. Relaunches and APK updates preserve edits,
	// including a deliberately deleted welcome note.
	if _, err := os.Stat(folder); errors.Is(err, os.ErrNotExist) {
		if err := os.MkdirAll(folder, 0700); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(folder, "Welcome.org"), []byte(androidWelcome), 0600); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	_, err := s.Open(folder)
	return err
}

const androidWelcome = `#+TITLE: Welcome to OrbitalNote on Android
#+FILETAGS: :testing:

* Your Android test notebook
This notebook lives on your phone in OrbitalNote's private app storage.
Edit this note, save it, create notes, and try the agenda and calendar.
The app works offline and does not need your Mac or a USB connection.

Notes survive closing the app and installing an updated APK.
Uninstalling the app or clearing its storage deletes this notebook.
Linking an existing Android folder is not implemented in this preview.

* TODO Try editing and saving a note
Use the Save button after making changes, then close and reopen the app.

* TODO Try scheduling a task
Use the calendar or the command palette to add a scheduled task.

* Checklist
- [ ] Edit and save on the phone
- [ ] Create a new note
- [ ] Try search and preview
- [ ] Check the layout with the keyboard open
`
