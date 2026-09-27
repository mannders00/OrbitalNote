//go:build ios

package main

import "github.com/wailsapp/wails/v3/pkg/application"

func openSystemURL(url string) error {
	application.IOS.OpenURL(url)
	return nil
}
