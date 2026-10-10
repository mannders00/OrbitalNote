package workspace

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

type unavailableStore struct {
	Store
	fail bool
}

func (s *unavailableStore) List() ([]File, error) {
	if s.fail {
		return nil, errors.New("permission lost")
	}
	return s.Store.List()
}

func TestProviderSwitchReconcileAndRevokedGrant(t *testing.T) {
	dir := t.TempDir()
	disk, err := OpenDisk(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer disk.Close()
	provider := &unavailableStore{Store: disk}
	if _, err := disk.Write("Note.org", []byte("* Old\r\n"), ""); err != nil {
		t.Fatal(err)
	}
	s := NewService()
	defer s.Close()
	state, err := OpenStore(s, "content://provider/tree/notes", "Notes", provider)
	if err != nil {
		t.Fatal(err)
	}
	if state.Key != Revision([]byte("content://provider/tree/notes")) {
		t.Fatal("provider identity was treated as a disk path")
	}
	old, _ := s.Read(state.ID, "Note.org")
	if err := os.WriteFile(filepath.Join(dir, "Note.org"), []byte("* External\r\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := s.Refresh(state.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save(state.ID, "Note.org", "* Local\r\n", old.Revision); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale write: %v", err)
	}
	provider.fail = true
	if err := s.Refresh(state.ID); err == nil {
		t.Fatal("revoked access accepted")
	}
	if len(s.Status().Files) != 1 || len(s.Status().Warnings) == 0 {
		t.Fatal("failed scan lost listing or did not block Sync")
	}
	if _, err := OpenStore(s, "other", "Other", provider); err == nil || s.Status().Key != state.Key {
		t.Fatal("failed switch replaced active workspace")
	}
	provider.fail = false
	if err := s.Refresh(state.ID); err != nil || len(s.Status().Warnings) != 0 {
		t.Fatal("regrant did not clear warning", err)
	}
}

func TestDocumentTransportAndPathBoundary(t *testing.T) {
	content := []byte("* Café 🌙\r\nunknown syntax\n")
	d := &DocumentStore{Tree: "content://provider/tree/notes", Call: func(b []byte) ([]byte, error) {
		var q documentRequest
		if err := json.Unmarshal(b, &q); err != nil {
			t.Fatal(err)
		}
		if q.Tree != "content://provider/tree/notes" {
			t.Fatal("missing tree identity")
		}
		r := documentResponse{}
		switch q.Op {
		case "write":
			if string(q.Data) != string(content) {
				t.Fatal("bytes changed in transport")
			}
			r.Revision = Revision(q.Data)
		case "read":
			if q.Path == "missing.org" {
				r.Code = "missing"
				r.Error = "gone"
			} else {
				r.Data = content
			}
		case "list":
			r.Files = []File{{Path: SettingsFile}, {Path: "Notes.org"}}
		}
		return json.Marshal(r)
	}}
	if _, err := d.Write("Note.org", content, ""); err != nil {
		t.Fatal(err)
	}
	if got, err := d.Read("Note.org"); err != nil || string(got) != string(content) {
		t.Fatal("read roundtrip", err)
	}
	if _, err := d.Read("missing.org"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("missing mapping", err)
	}
	for _, p := range []string{"../x.org", ".secret/x.org", "nested/.orbitalnote.org", "bad\\x.org"} {
		if _, err := d.Read(p); err == nil {
			t.Fatal("accepted", p)
		}
	}
	if _, err := d.Write(SettingsFile, content, ""); err != nil {
		t.Fatal(err)
	}
}

func TestRootSettingsFileIsOnlyHiddenException(t *testing.T) {
	d, err := OpenDisk(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	if _, err = d.Write(SettingsFile, []byte("#+TITLE: settings\n"), ""); err != nil {
		t.Fatal(err)
	}
	files, err := d.List()
	if err != nil || len(files) != 1 || files[0].Path != SettingsFile {
		t.Fatal(files, err)
	}
	for _, p := range []string{".secret.org", ".hidden/Note.org", "nested/.orbitalnote.org"} {
		if _, err := d.Write(p, []byte("x"), ""); err == nil {
			t.Fatal("accepted", p)
		}
	}
}
