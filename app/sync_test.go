package main

import "testing"

func TestSavedSyncCredentials(t *testing.T) {
	for _, origin := range []string{hostedSyncURL, "https://notes.example.com", "http://127.0.0.1:8090"} {
		api, err := savedSyncAPI(syncCredentials{Server: origin + "/", Token: "saved-device-token"})
		if err != nil || api.URL != origin || api.Token != "saved-device-token" {
			t.Fatalf("saved connection was not preserved: %v", err)
		}
	}
	for _, origin := range []string{"", "http://notes.example.com", "https://notes.example.com/path", "https://user:pass@notes.example.com"} {
		if _, err := savedSyncAPI(syncCredentials{Server: origin, Token: "other-service-token"}); err == nil {
			t.Fatalf("accepted credentials from %q", origin)
		}
	}
}
