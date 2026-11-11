package demo

import (
	"errors"
	"io/fs"
	"strings"
	"testing"
	"time"

	"github.com/mannders00/OrbitalNote/internal/workspace"
)

func TestStoreTransactionsAndIsolation(t *testing.T) {
	s := NewStore()
	for _, p := range []string{"../escape.org", "/absolute.org", "x/../escape.org", "x\\escape.org", ".private.org"} {
		if _, err := s.Write(p, []byte("bad"), ""); err == nil {
			t.Fatalf("accepted %q", p)
		}
	}
	if err := s.Mkdir("Notes"); err != nil {
		t.Fatal(err)
	}
	rev, err := s.Write("Notes/One.org", []byte("* One\n"), "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Write("Notes/One.org", []byte("lost edit"), ""); !errors.Is(err, workspace.ErrConflict) {
		t.Fatal(err)
	}
	b, _ := s.Read("Notes/One.org")
	b[0] = 'X'
	again, _ := s.Read("Notes/One.org")
	if again[0] != '*' {
		t.Fatal("read leaked mutable storage")
	}
	if err = s.Remove("Notes", ""); err == nil {
		t.Fatal("removed nonempty folder")
	}
	if err = s.Rename("Notes", "Renamed"); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Read("Notes/One.org"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal(err)
	}
	if err = s.Remove("Renamed/One.org", "stale"); !errors.Is(err, workspace.ErrConflict) {
		t.Fatal(err)
	}
	if err = s.Remove("Renamed/One.org", rev); err != nil {
		t.Fatal(err)
	}
	if err = s.Remove("Renamed", ""); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Write("Big.org", make([]byte, MaxBytes+1), ""); err == nil {
		t.Fatal("accepted oversized workspace")
	}
	if _, err = NewStore().Read("Welcome.org"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("stores share contents")
	}
}

func TestRealServiceRoundTripAndReset(t *testing.T) {
	now := time.Date(2027, 1, 1, 12, 0, 0, 0, time.UTC)
	s, err := NewService(now)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	id := s.Status().ID
	note, err := s.Read(id, "Launch.org")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(note.Source, "<2027-01-01 Fri 09:00-10:00>") {
		t.Fatal("sample dates did not follow local day")
	}
	changed, err := s.Edit(note.Source, note.Headings[1].Line, "delete-heading", "")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(changed, "Sketch the first version") || !strings.Contains(changed, "** TODO Ask for a second opinion") {
		t.Fatal("wrong heading deletion semantics")
	}
	saved, err := s.Save(id, note.Path, changed, note.Revision)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Save(id, note.Path, note.Source, note.Revision); !errors.Is(err, workspace.ErrConflict) {
		t.Fatal("stale write accepted", err)
	}
	read, _ := s.Read(id, note.Path)
	if read.Revision != saved.Revision {
		t.Fatal("save not indexed")
	}
	if _, err = Dispatch(s, Request{Method: "Open", Path: "/tmp"}); err == nil {
		t.Fatal("filesystem access accepted")
	}
	if _, err = Dispatch(s, Request{Method: "SyncConnect"}); err == nil {
		t.Fatal("sync accepted")
	}
	reset, err := NewService(now)
	if err != nil {
		t.Fatal(err)
	}
	defer reset.Close()
	fresh, _ := reset.Read(reset.Status().ID, note.Path)
	if fresh.Source != note.Source {
		t.Fatal("fresh instance retained edits")
	}
	if got := JSON(s, `{"method":`); !strings.Contains(got, `"error"`) {
		t.Fatal("invalid JSON not rejected")
	}
}
