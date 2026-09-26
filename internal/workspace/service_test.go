package workspace

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestIndexExternalAtomicSaveAndWorkspaceIsolation(t *testing.T) {
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "work"), 0755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(dir, "work", "project.org")
	if err := os.WriteFile(file, []byte("* TODO Before\nSCHEDULED: <2026-09-24 Thu>\n"), 0644); err != nil {
		t.Fatal(err)
	}
	s := NewService()
	defer s.Close()
	snap, err := s.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	items, err := s.Agenda(snap.ID)
	if err != nil || len(items) != 1 || items[0].Title != "Before" {
		t.Fatalf("agenda: %+v %v", items, err)
	}
	// Allow the watcher to register, then simulate Emacs' temporary-file + rename.
	time.Sleep(100 * time.Millisecond)
	tmp := filepath.Join(dir, "work", ".editor-save")
	if err = os.WriteFile(tmp, []byte("* TODO After\nDEADLINE: <2026-09-25 Fri>\n* DONE Completed\nSCHEDULED: <2026-09-01 Tue>\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err = os.Rename(tmp, file); err != nil {
		t.Fatal(err)
	}
	until := time.Now().Add(4 * time.Second)
	for {
		items, err = s.Agenda(snap.ID)
		if err == nil && len(items) == 1 && items[0].Title == "After" {
			break
		}
		if time.Now().After(until) {
			t.Fatalf("watcher failed: %+v %v", items, err)
		}
		time.Sleep(30 * time.Millisecond)
	}
	results, err := s.Search(snap.ID, "After")
	if err != nil || len(results) != 1 {
		t.Fatalf("search %+v %v", results, err)
	}
	if _, err = s.Open(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Save(snap.ID, "stale.org", "data", ""); err == nil {
		t.Fatal("old workspace save accepted")
	}
}
