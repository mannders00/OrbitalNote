package workspace

import (
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestConditionalWritePreservesExternalEdits(t *testing.T) {
	dir := t.TempDir()
	d, err := OpenDisk(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	original := []byte("* TODO Test\r\n#+UNKNOWN: é untouched\r\n")
	rev, err := d.Write("test.org", original, "")
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Chmod(filepath.Join(dir, "test.org"), 0600); err != nil {
		t.Fatal(err)
	}
	// Windows exposes writable/read-only attributes, not POSIX mode bits.
	// Preserve the actual platform mode rather than assuming chmod yields 0600.
	before, err := os.Stat(filepath.Join(dir, "test.org"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = d.Write("test.org", append(original, []byte("more\r\n")...), rev); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(filepath.Join(dir, "test.org"))
	if info.Mode().Perm() != before.Mode().Perm() {
		t.Fatal("permissions changed")
	}
	external := []byte("External editor wins its own version\n")
	if err = os.WriteFile(filepath.Join(dir, "test.org"), external, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = d.Write("test.org", []byte("stale"), rev); !errors.Is(err, ErrConflict) {
		t.Fatalf("wanted conflict: %v", err)
	}
	b, _ := d.Read("test.org")
	if string(b) != string(external) {
		t.Fatal("external data was overwritten")
	}
	if err = d.Remove("test.org", rev); !errors.Is(err, ErrConflict) {
		t.Fatal("stale delete accepted")
	}
	items, _ := os.ReadDir(dir)
	if len(items) != 1 {
		t.Fatal("temporary files leaked")
	}
}
func TestConfinementAndConcurrentCreation(t *testing.T) {
	dir := t.TempDir()
	d, err := OpenDisk(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	for _, p := range []string{"../outside.org", "/tmp/outside.org", "a/../../escape.org", "a\\b.org", ".hidden.org"} {
		if _, err = d.Write(p, []byte("x"), ""); err == nil {
			t.Errorf("accepted %q", p)
		}
	}
	outside := t.TempDir()
	if err = os.Symlink(outside, filepath.Join(dir, "link")); err == nil {
		if _, err = d.Write("link/escape.org", []byte("x"), ""); err == nil {
			t.Fatal("symlink accepted")
		}
	}
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for range 2 {
		wg.Go(func() { _, err := d.Write("race.org", []byte("* Hello"), ""); errs <- err })
	}
	wg.Wait()
	close(errs)
	wins, conflicts := 0, 0
	for err := range errs {
		if err == nil {
			wins++
		} else if errors.Is(err, ErrConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if wins != 1 || conflicts != 1 {
		t.Fatalf("wins=%d conflicts=%d", wins, conflicts)
	}
}

func TestDirectoryMovesAndNonRecursiveDeletion(t *testing.T) {
	d, err := OpenDisk(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	if err = d.Mkdir("folder"); err != nil {
		t.Fatal(err)
	}
	rev, err := d.Write("folder/a.org", []byte("* Keep me\n"), "")
	if err != nil {
		t.Fatal(err)
	}
	if err = d.Remove("folder", ""); err == nil {
		t.Fatal("deleted a nonempty folder")
	}
	if err = d.Rename("folder", "moved"); err != nil {
		t.Fatal(err)
	}
	if b, err := d.Read("moved/a.org"); err != nil || string(b) != "* Keep me\n" {
		t.Fatalf("move lost bytes: %q %v", b, err)
	}
	if err = d.Remove("moved/a.org", rev); err != nil {
		t.Fatal(err)
	}
	if err = d.Remove("moved", ""); err != nil {
		t.Fatal(err)
	}
}
