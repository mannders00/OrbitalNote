//go:build !android && !ios

package main

import (
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/zalando/go-keyring"
)

func secureSyncSet(key, value string) error    { return keyring.Set("OrbitalNote Sync", key, value) }
func secureSyncGet(key string) (string, error) { return keyring.Get("OrbitalNote Sync", key) }
func secureSyncDelete(key string) error {
	err := keyring.Delete("OrbitalNote Sync", key)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil
	}
	return err
}
func syncForeground() bool                      { return true }
func configureSyncLifecycle(_ *application.App) {}
