//go:build !ios

package main

import "github.com/wailsapp/wails/v3/pkg/application"

func openSystemURL(url string) error { return application.Get().Browser.OpenURL(url) }
