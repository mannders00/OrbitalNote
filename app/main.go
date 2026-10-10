package main

import (
	"errors"
	"log"
	"net/url"
	"sync/atomic"

	"github.com/mannders00/OrbitalNote/app/ui"
	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type Host struct {
	service   *workspace.Service
	sync      *syncManager
	allowQuit atomic.Bool
}

func (h *Host) Quit()              { h.allowQuit.Store(true); application.Get().Quit() }
func (h *Host) Zoom(direction int) { zoomWindow(direction) }
func (h *Host) OpenURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if u.Scheme != "http" && u.Scheme != "https" && u.Scheme != "mailto" {
		return errors.New("unsupported link scheme")
	}
	return openSystemURL(raw)
}

func (h *Host) ChooseWorkspace() (workspace.Snapshot, error) {
	p, err := chooseWorkspacePath()
	if err != nil || p == "" {
		return h.service.Status(), err
	}
	// Serialize folder changes with Sync configuration and reconciliation.
	h.sync.mu.Lock()
	defer h.sync.mu.Unlock()
	state, err := openWorkspacePath(h.service, p)
	if err == nil {
		if prefErr := rememberWorkspace(p); prefErr != nil {
			log.Printf("Could not remember workspace: %v", prefErr)
		}
	}
	return state, err
}

// Regrant the current folder without replacing its identity or open buffers.
// The frontend uses this path when unsaved edits prevent workspace switching.
func (h *Host) ReconnectWorkspace() (workspace.Snapshot, error) {
	p, err := chooseWorkspacePath()
	if err != nil || p == "" {
		return h.service.Status(), err
	}
	h.sync.mu.Lock()
	defer h.sync.mu.Unlock()
	state := h.service.Status()
	if workspace.Revision([]byte(p)) != state.Key {
		return state, errors.New("unsaved edits are retained; choose the currently linked folder to reconnect it, or save a copy before switching folders")
	}
	if err := h.service.Refresh(state.ID); err != nil {
		return h.service.Status(), err
	}
	return h.service.Status(), nil
}
func main() {
	s := workspace.NewService()
	defer s.Close()
	if err := openInitialWorkspace(s); err != nil {
		log.Fatal(err)
	}
	h := &Host{service: s, sync: newSyncManager(s)}
	defer h.sync.cancel()
	a := application.New(application.Options{Name: "OrbitalNote", Icon: appIcon, Description: "Your notes. Your calendar. Your files.", Services: []application.Service{application.NewService(s), application.NewService(h)}, Assets: application.AssetOptions{Handler: application.AssetFileServerFS(ui.Assets)}, Mac: application.MacOptions{ApplicationShouldTerminateAfterLastWindowClosed: true}, ShouldQuit: func() bool {
		if h.allowQuit.Load() {
			return true
		}
		application.Get().Event.Emit("workspace:request-close")
		return false
	}})
	configureZoom(a)
	configureSyncLifecycle(a)
	configureFolderLifecycle(a, s)
	go h.sync.run()
	// Retain native traffic lights and dragging; the transparent Mac title bar
	// uses the window background, updated by the frontend when appearance changes.
	w := a.Window.NewWithOptions(application.WebviewWindowOptions{Title: "OrbitalNote", Width: 1320, Height: 860, MinWidth: 680, MinHeight: 480, URL: "/", BackgroundColour: application.NewRGB(30, 30, 30), Mac: application.MacWindow{TitleBar: application.MacTitleBar{AppearsTransparent: true, FullSizeContent: true, HideTitle: true, HideToolbarSeparator: true}}})
	w.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		if !h.allowQuit.Load() {
			e.Cancel()
			a.Event.Emit("workspace:request-close")
		}
	})
	if err := a.Run(); err != nil {
		log.Fatal(err)
	}
}
