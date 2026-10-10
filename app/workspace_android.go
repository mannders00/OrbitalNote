package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

func init() {
	application.RegisterAndroidMain(main)
}

func configureFolderLifecycle(a *application.App, s *workspace.Service) {
	a.Event.OnApplicationEvent(events.Android.ActivityResumed, func(*application.ApplicationEvent) {
		go func() { _ = s.Refresh(s.Status().ID) }()
	})
}

func chooseWorkspacePath() (string, error) {
	response, err := androidDocuments([]byte(`{"op":"choose"}`))
	if err != nil {
		return "", err
	}
	var result struct {
		Tree  string `json:"tree"`
		Error string `json:"error"`
	}
	if err = json.Unmarshal(response, &result); err != nil {
		return "", err
	}
	if result.Error != "" {
		return "", errors.New(result.Error)
	}
	return result.Tree, nil
}

func openWorkspacePath(s *workspace.Service, tree string) (workspace.Snapshot, error) {
	if tree == "private" {
		return s.Open(filepath.Join(application.Android.StoragePath(), "Test Notebook"))
	}
	request, _ := json.Marshal(map[string]string{"op": "info", "tree": tree})
	response, err := androidDocuments(request)
	if err != nil {
		return workspace.Snapshot{}, err
	}
	var info struct {
		Name  string `json:"name"`
		Error string `json:"error"`
	}
	if err = json.Unmarshal(response, &info); err != nil {
		return workspace.Snapshot{}, err
	}
	if info.Error != "" {
		return workspace.Snapshot{}, errors.New(info.Error)
	}
	return workspace.OpenStore(s, tree, info.Name, &workspace.DocumentStore{Tree: tree, Call: androidDocuments, Active: syncForeground})
}

func openInitialWorkspace(s *workspace.Service) error {
	root := application.Android.StoragePath()
	if root == "" {
		return errors.New("Android did not provide an app storage directory")
	}
	if err := os.Setenv("XDG_CONFIG_HOME", filepath.Join(root, "config")); err != nil {
		return err
	}
	if tree := lastWorkspace(); tree != "" {
		// Keep the selected identity even when access was revoked. Do not silently
		// switch to another notebook and its Sync credentials.
		if _, err := openWorkspacePath(s, tree); err == nil {
			return nil
		}
		_, err := workspace.OpenUnavailableStore(s, tree, "Linked Android folder", &workspace.DocumentStore{Tree: tree, Call: androidDocuments, Active: syncForeground})
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
