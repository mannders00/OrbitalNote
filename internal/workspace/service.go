package workspace

import (
	"context"
	"errors"
	"fmt"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/mannders00/OrbitalNote/internal/orgdate"
	"github.com/mannders00/OrbitalNote/internal/orgdoc"
)

type Note struct {
	Path     string `json:"path"`
	Revision string `json:"revision"`
	orgdoc.Document
}
type Snapshot struct {
	ID       uint64   `json:"id"`
	Key      string   `json:"key"`
	Version  uint64   `json:"version"`
	Name     string   `json:"name"`
	Files    []File   `json:"files"`
	Warnings []string `json:"warnings"`
}
type Result struct {
	Path string `json:"path"`
	Line int    `json:"line"`
	Text string `json:"text"`
}
type Entry struct {
	FileTags []string      `json:"fileTags"`
	Revision string        `json:"revision"`
	Path     string        `json:"path"`
	Line     int           `json:"line"`
	Title    string        `json:"title"`
	State    string        `json:"state"`
	Tags     []string      `json:"tags"`
	Stamp    orgdate.Stamp `json:"stamp"`
	Done     bool          `json:"done"`
}

// Service is shared by the Wails host and the loopback development host.
// The mutex serializes workspace switching, mutations and snapshot replacement.
type Service struct {
	mu     sync.Mutex
	disk   *Disk
	store  Store
	root   string
	state  Snapshot
	notes  map[string]Note
	cancel context.CancelFunc
}

func NewService() *Service {
	return &Service{state: Snapshot{Files: []File{}, Warnings: []string{}}, notes: map[string]Note{}}
}

func (s *Service) Open(folder string) (Snapshot, error) {
	abs, err := filepath.Abs(folder)
	if err != nil {
		return Snapshot{}, err
	}
	disk, err := OpenDisk(abs)
	if err != nil {
		return Snapshot{}, err
	}
	// Validate a new workspace before replacing the current one.
	if _, err = disk.List(); err != nil {
		disk.Close()
		return Snapshot{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
	if s.disk != nil {
		s.disk.Close()
	}
	s.disk = disk
	s.store = disk
	s.root = abs
	s.notes = map[string]Note{}
	s.state = Snapshot{ID: s.state.ID + 1, Key: Revision([]byte(abs)), Version: s.state.Version + 1, Name: filepath.Base(abs), Files: []File{}, Warnings: []string{}}
	if err = s.reconcile(); err != nil {
		return s.state, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	go s.watch(ctx, abs, s.state.ID)
	return s.state, nil
}
func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
	if s.disk != nil {
		s.disk.Close()
	}
	s.store = nil
}
func (s *Service) check(id uint64) error {
	if s.store == nil {
		return errors.New("open a workspace first")
	}
	if id != s.state.ID {
		return errors.New("workspace changed; reopen the document")
	}
	return nil
}
func (s *Service) Status() Snapshot { s.mu.Lock(); defer s.mu.Unlock(); return s.state }

func (s *Service) reconcile() error {
	files, err := s.store.List()
	if err != nil {
		return err
	}
	next := map[string]Note{}
	warnings := []string{}
	changed := fmt.Sprint(files) != fmt.Sprint(s.state.Files)
	for _, f := range files {
		if f.Directory {
			continue
		}
		b, e := s.store.Read(f.Path)
		if e != nil {
			warnings = append(warnings, f.Path+": "+e.Error())
			continue
		}
		if !utf8.Valid(b) {
			warnings = append(warnings, f.Path+": non-UTF-8 file left untouched")
			continue
		}
		rev := Revision(b)
		if old, ok := s.notes[f.Path]; ok && old.Revision == rev {
			next[f.Path] = old
		} else {
			next[f.Path] = Note{Path: f.Path, Revision: rev, Document: orgdoc.Parse(string(b))}
			changed = true
		}
	}
	if len(next) != len(s.notes) || fmt.Sprint(warnings) != fmt.Sprint(s.state.Warnings) {
		changed = true
	}
	s.notes = next
	s.state.Files = files
	s.state.Warnings = warnings
	if changed {
		s.state.Version++
	}
	return nil
}
func (s *Service) Read(id uint64, p string) (Note, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return Note{}, err
	}
	b, err := s.store.Read(p)
	if err != nil {
		return Note{}, err
	}
	if !utf8.Valid(b) {
		return Note{}, errors.New("only UTF-8 Org files can be edited")
	}
	return Note{Path: p, Revision: Revision(b), Document: orgdoc.Parse(string(b))}, nil
}
func (s *Service) Save(id uint64, p, source, revision string) (Note, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return Note{}, err
	}
	rev, err := s.store.Write(p, []byte(source), revision)
	if err != nil {
		return Note{}, err
	}
	n := Note{Path: p, Revision: rev, Document: orgdoc.Parse(source)}
	s.notes[p] = n
	s.state.Version++
	if files, e := s.store.List(); e == nil {
		s.state.Files = files
	}
	return n, nil
}
func (s *Service) Preview(source string) (orgdoc.Document, error) {
	if len(source) > MaxFileSize {
		return orgdoc.Document{}, errors.New("document exceeds 8 MiB")
	}
	return orgdoc.Parse(source), nil
}
func (s *Service) Mkdir(id uint64, p string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return err
	}
	if err := s.store.Mkdir(p); err != nil {
		return err
	}
	return s.reconcile()
}
func (s *Service) Rename(id uint64, from, to string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return err
	}
	isDirectory := false
	for _, f := range s.state.Files {
		if f.Path == from {
			isDirectory = f.Directory
			break
		}
	}
	if !isDirectory && !strings.EqualFold(path.Ext(to), ".org") {
		return errors.New("destination must end in .org")
	}
	if err := s.store.Rename(from, to); err != nil {
		return err
	}
	return s.reconcile()
}
func (s *Service) Remove(id uint64, p, revision string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return err
	}
	if err := s.store.Remove(p, revision); err != nil {
		return err
	}
	return s.reconcile()
}
func (s *Service) Search(id uint64, query string) ([]Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return nil, err
	}
	out := []Result{}
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		return out, nil
	}
	paths := make([]string, 0, len(s.notes))
	for p := range s.notes {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	for _, p := range paths {
		n := s.notes[p]
		if strings.Contains(strings.ToLower(p), q) {
			out = append(out, Result{p, 1, p})
		}
		for i, line := range strings.Split(n.Source, "\n") {
			if strings.Contains(strings.ToLower(line), q) {
				out = append(out, Result{p, i + 1, line})
			}
			if len(out) >= 200 {
				return out, nil
			}
		}
	}
	return out, nil
}
func (s *Service) Backlinks(id uint64, p string) ([]Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return nil, err
	}
	out := []Result{}
	for file, n := range s.notes {
		for _, l := range n.Links {
			target := strings.TrimPrefix(l.Target, "file:")
			target = strings.SplitN(target, "::", 2)[0]
			if path.Clean(path.Join(path.Dir(file), target)) == p {
				out = append(out, Result{file, l.Line, l.Target})
			}
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Path == out[j].Path {
			return out[i].Line < out[j].Line
		}
		return out[i].Path < out[j].Path
	})
	return out, nil
}
func (s *Service) Agenda(id uint64) ([]Entry, error) {
	return s.calendarEntries(id, false)
}

// Calendar retains completed events so their time blocks remain visible.
func (s *Service) Calendar(id uint64) ([]Entry, error) {
	return s.calendarEntries(id, true)
}

func (s *Service) calendarEntries(id uint64, includeDone bool) ([]Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return nil, err
	}
	out := []Entry{}
	for p, n := range s.notes {
		for _, h := range n.Headings {
			if h.Done && !includeDone {
				continue
			}
			count := 0
			for _, st := range h.Dates {
				if !st.Active {
					continue
				}
				out = append(out, Entry{n.FileTags, n.Revision, p, h.Line, h.Title, h.State, h.Tags, st, h.Done})
				count++
			}
			if count == 0 && h.State != "" {
				out = append(out, Entry{n.FileTags, n.Revision, p, h.Line, h.Title, h.State, h.Tags, orgdate.Stamp{Kind: "todo"}, h.Done})
			}
		}
	}
	sort.Slice(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Stamp.Date != b.Stamp.Date {
			return a.Stamp.Date < b.Stamp.Date
		}
		if a.Stamp.Time != b.Stamp.Time {
			return a.Stamp.Time < b.Stamp.Time
		}
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		return a.Line < b.Line
	})
	return out, nil
}
