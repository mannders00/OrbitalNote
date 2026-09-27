package main

import "testing"

func TestHostedSyncCredentials(t *testing.T) {
	for _, origin := range []string{hostedSyncURL, hostedSyncURL + "/"} {
		api, err := hostedSyncAPI(syncCredentials{Server: origin, Token: "saved-device-token"})
		if err != nil || api.URL != hostedSyncURL || api.Token != "saved-device-token" {
			t.Fatalf("existing hosted connection was not preserved: %v", err)
		}
	}
	for _, origin := range []string{"", "https://another.example", "http://sync.orbitalnote.org", hostedSyncURL + ".example"} {
		if _, err := hostedSyncAPI(syncCredentials{Server: origin, Token: "other-service-token"}); err == nil {
			t.Fatalf("accepted credentials from %q", origin)
		}
	}
}
