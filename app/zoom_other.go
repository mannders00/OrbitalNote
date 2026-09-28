//go:build !darwin || ios || server

package main

import "github.com/wailsapp/wails/v3/pkg/application"

func configureZoom(_ *application.App) {}
func zoomWindow(direction int) {
	application.InvokeSync(func() {
		if window := application.Get().Window.Current(); window != nil {
			switch direction {
			case -1:
				window.ZoomOut()
			case 0:
				window.ZoomReset()
			case 1:
				window.ZoomIn()
			}
		}
	})
}
