//go:build darwin && !ios && !server

package main

/*
#cgo LDFLAGS: -framework Cocoa -framework WebKit
void orgWorkspaceZoom(void *window, int direction);
void orgWorkspaceInputDefaults(void);
*/
import "C"

import "github.com/wailsapp/wails/v3/pkg/application"

// Wails' default macOS zoom uses magnification, which pans a larger canvas.
// Keep the standard menu and shortcuts, but use WebKit's reflowing page zoom.
func configureZoom(a *application.App) {
	C.orgWorkspaceInputDefaults()
	menu := application.DefaultApplicationMenu()
	for label, direction := range map[string]int{"Actual Size": 0, "Zoom In": 1, "Zoom Out": -1} {
		menu.FindByLabel(label).OnClick(func(_ *application.Context) {
			application.InvokeSync(func() {
				if window := a.Window.Current(); window != nil {
					C.orgWorkspaceZoom(window.NativeWindow(), C.int(direction))
				}
			})
		})
	}
	a.Menu.Set(menu)
}
