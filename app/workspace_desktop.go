//go:build !android && !ios

package main

import (
	"log"
	"os"

	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func chooseWorkspacePath() (string, error) {
	return application.Get().Dialog.OpenFile().CanChooseDirectories(true).CanChooseFiles(false).PromptForSingleSelection()
}

func openInitialWorkspace(s *workspace.Service) error {
	if len(os.Args) > 1 {
		_, err := s.Open(os.Args[1])
		return err
	}
	if folder := lastWorkspace(); folder != "" {
		if _, err := s.Open(folder); err != nil {
			log.Printf("Last workspace is unavailable: %v", err)
		}
	}
	return nil
}
