//go:build android || ios

package main

import (
	"errors"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

var syncPaused atomic.Bool

func secureSyncSet(key, value string) error { return application.Mobile.SecureSet("sync-"+key, value) }
func secureSyncGet(key string) (string, error) {
	v, found, err := application.Mobile.SecureGet("sync-" + key)
	if err == nil && !found {
		err = errors.New("Sync credentials are missing from secure storage; reconnect this device")
	}
	return v, err
}
func secureSyncDelete(key string) error { return application.Mobile.SecureDelete("sync-" + key) }
func syncForeground() bool              { return !syncPaused.Load() }
func configureSyncLifecycle(a *application.App) {
	a.Event.OnApplicationEvent(events.Android.ActivityPaused, func(*application.ApplicationEvent) { syncPaused.Store(true) })
	a.Event.OnApplicationEvent(events.Android.ActivityResumed, func(*application.ApplicationEvent) { syncPaused.Store(false) })
	a.Event.OnApplicationEvent(events.IOS.ApplicationDidEnterBackground, func(*application.ApplicationEvent) { syncPaused.Store(true) })
	a.Event.OnApplicationEvent(events.IOS.ApplicationWillEnterForeground, func(*application.ApplicationEvent) { syncPaused.Store(false) })
}
