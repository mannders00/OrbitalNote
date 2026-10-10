package syncclient

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mannders00/OrbitalNote/internal/workspace"
)

type unavailableProvider struct {
	workspace.Store
	unavailable atomic.Bool
}

func (s *unavailableProvider) List() ([]workspace.File, error) {
	if s.unavailable.Load() {
		return nil, errors.New("provider permission revoked")
	}
	return s.Store.List()
}

// This deliberately exercises the separately built server binary over HTTP,
// including website signup, manual entitlement, and browser device approval.
// scripts/check-sync.sh supplies the executable, without making the local app
// depend on the proprietary server module.
func TestTwoDeviceSyncIntegration(t *testing.T) {
	binary := os.Getenv("ORBITAL_SYNC_TEST_SERVER")
	if binary == "" {
		t.Skip("run bash scripts/check-sync.sh for real-server integration")
	}
	ctx := context.Background()
	root := t.TempDir()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := ln.Addr().String()
	ln.Close()
	origin := "http://" + address
	env := append(os.Environ(), "SYNC_DATA_DIR="+filepath.Join(root, "server"), "SYNC_LISTEN="+address, "SYNC_PUBLIC_URL="+origin, "SYNC_SIGNUP_CODE=integration-test-invitation", "SYNC_S3_BUCKET=")
	var process *exec.Cmd
	start := func() {
		process = exec.Command(binary)
		process.Env = env
		var output bytes.Buffer
		process.Stdout = &output
		process.Stderr = &output
		if err := process.Start(); err != nil {
			t.Fatal(err)
		}
		for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); {
			r, e := http.Get(origin + "/healthz")
			if e == nil {
				r.Body.Close()
				if r.StatusCode == 200 {
					return
				}
			}
			time.Sleep(40 * time.Millisecond)
		}
		_ = process.Process.Kill()
		_ = process.Wait()
		t.Fatal("server failed to start:", output.String())
	}
	stop := func() {
		if process != nil {
			_ = process.Process.Signal(os.Interrupt)
			_ = process.Wait()
			process = nil
		}
	}
	start()
	t.Cleanup(stop)
	jar, _ := cookiejar.New(nil)
	browser := &http.Client{Jar: jar, Timeout: 10 * time.Second}
	csrfRE := regexp.MustCompile(`name="csrf" value="([a-f0-9]+)"`)
	formToken := func(path string) string {
		r, e := browser.Get(origin + path)
		if e != nil {
			t.Fatal(e)
		}
		b, _ := io.ReadAll(r.Body)
		r.Body.Close()
		match := csrfRE.FindSubmatch(b)
		if len(match) != 2 {
			t.Fatalf("no CSRF token on %s: %s", path, b)
		}
		return string(match[1])
	}
	postForm := func(path string, values url.Values) {
		r, e := browser.PostForm(origin+path, values)
		if e != nil {
			t.Fatal(e)
		}
		b, _ := io.ReadAll(r.Body)
		r.Body.Close()
		if r.StatusCode != 200 {
			t.Fatalf("form %s: %d %s", path, r.StatusCode, b)
		}
	}
	postForm("/signup", url.Values{"csrf": {formToken("/signup")}, "email": {"sync@example.com"}, "password": {"a-long-test-password"}, "invite": {"integration-test-invitation"}})
	grant := exec.Command(binary, "grant", "--email", "sync@example.com", "--days", "30")
	grant.Env = env
	if b, e := grant.CombinedOutput(); e != nil {
		t.Fatalf("grant: %s %v", b, e)
	}
	// Exercise a fresh website login rather than relying on signup's session.
	jar, _ = cookiejar.New(nil)
	browser.Jar = jar
	postForm("/login", url.Values{"csrf": {formToken("/login")}, "email": {"sync@example.com"}, "password": {"a-long-test-password"}})
	authorize := func(label string) *API {
		a, _ := NewAPI(origin, "")
		var d struct{ Token, Code, URL string }
		if err := a.Request(ctx, "POST", "/api/device/start", map[string]string{"label": label}, &d); err != nil {
			t.Fatal(err)
		}
		postForm("/device", url.Values{"csrf": {formToken("/device?code=" + d.Code)}, "code": {d.Code}})
		var poll struct{ Approved bool }
		if err := a.Request(ctx, "POST", "/api/device/poll", map[string]string{"token": d.Token}, &poll); err != nil || !poll.Approved {
			t.Fatal("device approval", err)
		}
		a.Token = d.Token
		return a
	}
	apiA, apiB := authorize("Mac"), authorize("Android")
	keys, _ := NewKeys()
	v := Vault{ID: keys.Vault, Check: keys.Check()}
	if err = apiA.Request(ctx, "POST", "/api/vault", v, &v); err != nil {
		t.Fatal(err)
	}
	var provider *unavailableProvider
	makeEngine := func(name string, api *API) (*Engine, *workspace.Service) {
		folder := filepath.Join(root, name)
		if err := os.Mkdir(folder, 0700); err != nil {
			t.Fatal(err)
		}
		ws := workspace.NewService()
		t.Cleanup(ws.Close)
		if name == "android" {
			disk, err := workspace.OpenDisk(folder)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { ws.Close(); disk.Close() })
			provider = &unavailableProvider{Store: disk}
			if _, err := workspace.OpenStore(ws, "content://test/tree/android", "Android folder", provider); err != nil {
				t.Fatal(err)
			}
		} else if _, err := ws.Open(folder); err != nil {
			t.Fatal(err)
		}
		recovered, err := ParseRecovery(keys.Recovery())
		if err != nil {
			t.Fatal(err)
		}
		e, err := NewEngine(api, recovered, ws, filepath.Join(root, name+".journal"))
		if err != nil {
			t.Fatal(err)
		}
		return e, ws
	}
	a, wa := makeEngine("mac", apiA)
	b, wb := makeEngine("android", apiB)
	put := func(w *workspace.Service, p, source string) {
		id := w.Status().ID
		old, e := w.Read(id, p)
		rev := ""
		if e == nil {
			rev = old.Revision
		} else if !errors.Is(e, os.ErrNotExist) {
			t.Fatal(e)
		}
		if _, err := w.Save(id, p, source, rev); err != nil {
			t.Fatal(err)
		}
	}
	read := func(w *workspace.Service, p string) string {
		n, err := w.Read(w.Status().ID, p)
		if err != nil {
			t.Fatal(err)
		}
		return n.Source
	}
	tick := func(e *Engine) {
		if err := e.Tick(ctx); err != nil {
			t.Fatal(err)
		}
	}
	original := "#+TITLE: Private\r\n* Initial note\r\nUntouched line endings.\n"
	put(wa, "Private.org", original)
	tick(a)
	tick(b)
	if got := read(wb, "Private.org"); got != original {
		t.Fatalf("source changed in transit: %q", got)
	}
	settings := "#+TITLE: OrbitalNote shared settings\n\n#+begin_src json\n{\"version\":1,\"groups\":{\"calendar\":{\"colors\":{\"work\":\"#abcdef\"}}}}\n#+end_src\n"
	put(wa, ".orbitalnote.org", settings)
	tick(a)
	tick(b)
	if got := read(wb, ".orbitalnote.org"); got != settings {
		t.Fatal("workspace settings did not survive encrypted sync unchanged")
	}
	provider.unavailable.Store(true)
	if err := b.Tick(ctx); err == nil {
		t.Fatal("Sync accepted an unavailable provider as an empty folder")
	}
	provider.unavailable.Store(false)
	tick(b)
	tick(a)
	if read(wa, "Private.org") != original {
		t.Fatal("provider failure propagated a deletion")
	}
	put(wa, ".orbitalnote.org", settings+"\nMac settings\n")
	put(wb, ".orbitalnote.org", settings+"\nAndroid settings\n")
	tick(a)
	tick(b)
	tick(a)
	settingsConflict := false
	for _, f := range wa.Status().Files {
		if strings.HasPrefix(f.Path, "OrbitalNote-settings (sync conflict ") && read(wa, f.Path) == settings+"\nMac settings\n" {
			settingsConflict = true
		}
	}
	if !settingsConflict {
		t.Fatal("hidden settings conflict was not preserved in a syncable recovery note")
	}
	// Offline concurrent edits: preserve the remote version in a conflict file.
	put(wa, "Private.org", "* Mac offline edit\n")
	put(wb, "Private.org", "* Android offline edit\n")
	tick(a)
	tick(b)
	tick(a)
	if read(wa, "Private.org") != "* Android offline edit\n" {
		t.Fatal("devices did not converge")
	}
	found := false
	for _, f := range wa.Status().Files {
		if strings.Contains(f.Path, "sync conflict") && read(wa, f.Path) == "* Mac offline edit\n" {
			found = true
		}
	}
	if !found {
		t.Fatal("concurrent version was lost")
	}
	// Remote deletion versus local edit keeps the edit and restores the file.
	n, _ := wa.Read(wa.Status().ID, "Private.org")
	if err := wa.Remove(wa.Status().ID, n.Path, n.Revision); err != nil {
		t.Fatal(err)
	}
	put(wb, "Private.org", "* Keep edit racing deletion\n")
	tick(a)
	tick(b)
	tick(a)
	if read(wa, "Private.org") != "* Keep edit racing deletion\n" {
		t.Fatal("delete/edit race lost content")
	}
	// A response disappears after the server commits. Restart the client from
	// disk and repeat its exact operation rather than generating another revision.
	put(wa, "Retry.org", "* Saved despite a lost response\n")
	apiA.HTTP = &http.Client{Timeout: 10 * time.Second, Transport: &dropCommitResponse{base: http.DefaultTransport}}
	if err := a.Tick(ctx); err == nil {
		t.Fatal("expected simulated connection loss")
	}
	apiA.HTTP = &http.Client{Timeout: 10 * time.Second}
	a, err = NewEngine(apiA, keys, wa, a.Journal)
	if err != nil {
		t.Fatal(err)
	}
	tick(a)
	tick(b)
	if read(wb, "Retry.org") != "* Saved despite a lost response\n" {
		t.Fatal("durable retry failed")
	}
	var m Manifest
	if err = apiA.Request(ctx, "GET", "/api/manifest", nil, &m); err != nil {
		t.Fatal(err)
	}
	for _, h := range m.Heads {
		if h.File == keys.FileID("Retry.org") {
			encrypted, _ := keys.Encrypt(Document{Path: "Retry.org", Source: []byte("* Saved despite a lost response\n")})
			if h.Size != int64(len(encrypted)) {
				t.Fatal("lost-response retry duplicated history")
			}
		}
	}
	// Server restart retains sessions, entitlement, revision pointers, and data.
	stop()
	start()
	tick(a)
	tick(b)
	put(wb, "After restart.org", "* Still works\n")
	tick(b)
	tick(a)
	if read(wa, "After restart.org") != "* Still works\n" {
		t.Fatal("server restart failed")
	}
	// Clean deletion propagates normally, even after both clients restart state.
	n, _ = wb.Read(wb.Status().ID, "After restart.org")
	if err = wb.Remove(wb.Status().ID, n.Path, n.Revision); err != nil {
		t.Fatal(err)
	}
	tick(b)
	tick(a)
	if _, err = wa.Read(wa.Status().ID, n.Path); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("deletion did not propagate", err)
	}
	// A suspended subscription must not prevent downloads just because the
	// client has a durable upload waiting in its outbox.
	put(wa, "Pending.org", "* Keep this pending edit\n")
	apiA.HTTP.Transport = offlineUploads{}
	if err = a.Tick(ctx); err == nil {
		t.Fatal("expected offline upload")
	}
	apiA.HTTP.Transport = nil
	put(wb, "Download while inactive.org", "* Still downloadable\n")
	tick(b)
	grant = exec.Command(binary, "grant", "--email", "sync@example.com", "--days", "0")
	grant.Env = env
	if output, err := grant.CombinedOutput(); err != nil {
		t.Fatalf("disable: %s %v", output, err)
	}
	var inactive *APIError
	if err = a.Tick(ctx); !errors.As(err, &inactive) || inactive.Status != 402 {
		t.Fatalf("expected inactive entitlement: %v", err)
	}
	if read(wa, "Download while inactive.org") != "* Still downloadable\n" {
		t.Fatal("pending upload blocked downloads")
	}
	if read(wa, "Pending.org") != "* Keep this pending edit\n" {
		t.Fatal("inactive entitlement changed local files")
	}
	grant = exec.Command(binary, "grant", "--email", "sync@example.com", "--days", "30")
	grant.Env = env
	if output, err := grant.CombinedOutput(); err != nil {
		t.Fatalf("reenable: %s %v", output, err)
	}
	tick(a)
	tick(b)
	if read(wb, "Pending.org") != "* Keep this pending edit\n" {
		t.Fatal("outbox did not resume")
	}
	// S3-style objects contain neither file names nor source text.
	err = filepath.WalkDir(filepath.Join(root, "server", "objects"), func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		if bytes.Contains(data, []byte("Private.org")) || bytes.Contains(data, []byte("offline edit")) {
			return fmt.Errorf("plaintext found in object %s", p)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

type dropCommitResponse struct {
	base    http.RoundTripper
	dropped bool
}

type offlineUploads struct{}

func (offlineUploads) RoundTrip(r *http.Request) (*http.Response, error) {
	if r.URL.Path == "/api/commit" {
		return nil, errors.New("simulated offline upload")
	}
	return http.DefaultTransport.RoundTrip(r)
}

func (d *dropCommitResponse) RoundTrip(r *http.Request) (*http.Response, error) {
	resp, err := d.base.RoundTrip(r)
	if err == nil && r.URL.Path == "/api/commit" && !d.dropped {
		d.dropped = true
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		return nil, errors.New("simulated lost commit response")
	}
	return resp, err
}
