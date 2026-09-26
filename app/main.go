package main

import (
	"errors"
	"log"
	"net/url"
	"os"
	"sync/atomic"

	"github.com/mannders00/OrbitalNote/app/ui"
	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type Host struct {
	service   *workspace.Service
	allowQuit atomic.Bool
}

func (h *Host) Quit() { h.allowQuit.Store(true); application.Get().Quit() }
func (h *Host) OpenURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if u.Scheme != "http" && u.Scheme != "https" && u.Scheme != "mailto" {
		return errors.New("unsupported link scheme")
	}
	return application.Get().Browser.OpenURL(raw)
}

func (h *Host) ChooseWorkspace() (workspace.Snapshot, error) {
	p, err := application.Get().Dialog.OpenFile().CanChooseDirectories(true).CanChooseFiles(false).PromptForSingleSelection()
	if err != nil || p == "" {
		return h.service.Status(), err
	}
	state, err := h.service.Open(p)
	if err == nil {
		if prefErr := rememberWorkspace(p); prefErr != nil {
			log.Printf("Could not remember workspace: %v", prefErr)
		}
	}
	return state, err
}
func main() {
	s := workspace.NewService()
	defer s.Close()
	if len(os.Args) > 1 {
		if _, err := s.Open(os.Args[1]); err != nil {
			log.Fatal(err)
		}
	} else if folder := lastWorkspace(); folder != "" {
		if _, err := s.Open(folder); err != nil {
			log.Printf("Last workspace is unavailable: %v", err)
		}
	}
	h := &Host{service: s}
	a := application.New(application.Options{Name: "OrbitalNote", Description: "Your notes. Your calendar. Your files.", Services: []application.Service{application.NewService(s), application.NewService(h)}, Assets: application.AssetOptions{Handler: application.AssetFileServerFS(ui.Assets)}, Mac: application.MacOptions{ApplicationShouldTerminateAfterLastWindowClosed: true}, ShouldQuit: func() bool {
		if h.allowQuit.Load() {
			return true
		}
		application.Get().Event.Emit("workspace:request-close")
		return false
	}})
	configureZoom(a)
	// Retain native traffic lights and dragging; the transparent Mac title bar
	// uses the window background, updated by the frontend when appearance changes.
	w := a.Window.NewWithOptions(application.WebviewWindowOptions{Title: "OrbitalNote", Width: 1320, Height: 860, MinWidth: 680, MinHeight: 480, URL: "/", BackgroundColour: application.NewRGB(30, 30, 30), Mac: application.MacWindow{TitleBar: application.MacTitleBar{AppearsTransparent: true, HideTitle: true, HideToolbarSeparator: true}}})
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
