//go:build !android

package main

import (
	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func configureFolderLifecycle(a *application.App, s *workspace.Service) {}

func openWorkspacePath(s *workspace.Service, path string) (workspace.Snapshot, error) {
	return s.Open(path)
}
