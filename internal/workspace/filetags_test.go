package workspace

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestFileTagsIndexAndAgenda(t *testing.T) {
	dir := t.TempDir()
	source := "#+filetags: :work:blue:\n#+FILETAGS: :work:team:\n#+begin_src org\n#+FILETAGS: :ignored:\n#+end_src\n* TODO Specific :urgent:\nSCHEDULED: <2026-09-24 Thu>\n* TODO Fallback\n"
	if err := os.WriteFile(filepath.Join(dir, "tasks.org"), []byte(source), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "empty.org"), []byte("#+FILETAGS: :reference:\n"), 0644); err != nil {
		t.Fatal(err)
	}
	s := NewService()
	defer s.Close()
	snap, err := s.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	tags, err := s.Tags(snap.ID)
	if err != nil {
		t.Fatal(err)
	}
	want := []Tag{{"blue", 1}, {"reference", 1}, {"team", 1}, {"urgent", 1}, {"work", 1}}
	if !reflect.DeepEqual(tags, want) {
		t.Fatalf("tags = %#v", tags)
	}
	entries, err := s.Agenda(snap.ID)
	if err != nil || len(entries) != 2 {
		t.Fatalf("agenda = %#v, %v", entries, err)
	}
	for _, e := range entries {
		if !reflect.DeepEqual(e.FileTags, []string{"work", "blue", "team"}) {
			t.Fatalf("file tags = %#v", e)
		}
		if e.Title == "Specific" && !reflect.DeepEqual(e.Tags, []string{"urgent"}) {
			t.Fatalf("heading tags = %#v", e)
		}
		if e.Title == "Fallback" && len(e.Tags) != 0 {
			t.Fatalf("file tags merged into heading tags: %#v", e)
		}
	}
}
