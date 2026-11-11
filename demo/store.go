// Package demo supplies disposable storage for the unmodified workspace service.
package demo

import (
	"errors"
	"io/fs"
	"path"
	"sort"
	"strings"
	"sync"

	"github.com/mannders00/OrbitalNote/internal/workspace"
)

const MaxBytes = 4 << 20
const MaxEntries = 128

type Store struct {
	mu    sync.Mutex
	files map[string][]byte
	dirs  map[string]bool
}

func NewStore() *Store { return &Store{files: map[string][]byte{}, dirs: map[string]bool{}} }
func valid(p string) bool {
	if p == workspace.SettingsFile {
		return true
	}
	if !fs.ValidPath(p) || p == "." || len(p) > 240 || strings.ContainsAny(p, "\\\x00") {
		return false
	}
	for _, part := range strings.Split(p, "/") {
		if strings.HasPrefix(part, ".") {
			return false
		}
	}
	return true
}
func (s *Store) parent(p string) bool { return path.Dir(p) == "." || s.dirs[path.Dir(p)] }
func (s *Store) List() ([]workspace.File, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	files := []workspace.File{}
	for p := range s.files {
		files = append(files, workspace.File{Path: p})
	}
	for p := range s.dirs {
		files = append(files, workspace.File{Path: p, Directory: true})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	return files, nil
}
func (s *Store) Read(p string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !valid(p) {
		return nil, fs.ErrInvalid
	}
	b, ok := s.files[p]
	if !ok {
		return nil, fs.ErrNotExist
	}
	return append([]byte{}, b...), nil
}
func (s *Store) Write(p string, b []byte, rev string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !valid(p) || !strings.EqualFold(path.Ext(p), ".org") {
		return "", fs.ErrInvalid
	}
	if !s.parent(p) {
		return "", fs.ErrNotExist
	}
	if s.dirs[p] {
		return "", fs.ErrExist
	}
	old, exists := s.files[p]
	if exists && workspace.Revision(old) != rev || !exists && rev != "" {
		return "", workspace.ErrConflict
	}
	if !exists && len(s.files)+len(s.dirs) >= MaxEntries {
		return "", errors.New("demo limit: 128 files and folders; reset to start again")
	}
	size := len(b)
	for key, data := range s.files {
		if key != p {
			size += len(data)
		}
	}
	if size > MaxBytes {
		return "", errors.New("demo limit: 4 MiB; reset to start again")
	}
	s.files[p] = append([]byte{}, b...)
	return workspace.Revision(b), nil
}
func (s *Store) Mkdir(p string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !valid(p) {
		return fs.ErrInvalid
	}
	if _, ok := s.files[p]; ok || s.dirs[p] {
		return fs.ErrExist
	}
	if !s.parent(p) {
		return fs.ErrNotExist
	}
	if len(s.files)+len(s.dirs) >= MaxEntries {
		return errors.New("demo file limit reached")
	}
	s.dirs[p] = true
	return nil
}
func (s *Store) Rename(p, to string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !valid(p) || !valid(to) || strings.HasPrefix(to, p+"/") {
		return fs.ErrInvalid
	}
	if _, ok := s.files[to]; ok || s.dirs[to] {
		return fs.ErrExist
	}
	if !s.parent(to) {
		return fs.ErrNotExist
	}
	if b, ok := s.files[p]; ok {
		if !strings.EqualFold(path.Ext(to), ".org") {
			return fs.ErrInvalid
		}
		s.files[to] = b
		delete(s.files, p)
		return nil
	}
	if !s.dirs[p] {
		return fs.ErrNotExist
	}
	files := map[string][]byte{}
	dirs := map[string]bool{}
	for key, b := range s.files {
		if strings.HasPrefix(key, p+"/") {
			next := to + strings.TrimPrefix(key, p)
			if !valid(next) {
				return fs.ErrInvalid
			}
			files[next] = b
		}
	}
	for key := range s.dirs {
		if key == p || strings.HasPrefix(key, p+"/") {
			next := to + strings.TrimPrefix(key, p)
			if !valid(next) {
				return fs.ErrInvalid
			}
			dirs[next] = true
		}
	}
	for key, b := range files {
		delete(s.files, p+strings.TrimPrefix(key, to))
		s.files[key] = b
	}
	for key := range dirs {
		delete(s.dirs, p+strings.TrimPrefix(key, to))
		s.dirs[key] = true
	}
	return nil
}
func (s *Store) Remove(p, rev string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !valid(p) {
		return fs.ErrInvalid
	}
	if b, ok := s.files[p]; ok {
		if workspace.Revision(b) != rev {
			return workspace.ErrConflict
		}
		delete(s.files, p)
		return nil
	}
	if !s.dirs[p] {
		return fs.ErrNotExist
	}
	for key := range s.files {
		if strings.HasPrefix(key, p+"/") {
			return errors.New("folder is not empty")
		}
	}
	for key := range s.dirs {
		if strings.HasPrefix(key, p+"/") {
			return errors.New("folder is not empty")
		}
	}
	delete(s.dirs, p)
	return nil
}

// The demo has no external filesystem changes to poll.
func (s *Store) PollReady() bool { return false }
