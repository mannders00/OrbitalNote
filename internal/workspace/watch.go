package workspace

import (
	"context"
	"io/fs"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
)

func (s *Service) watch(ctx context.Context, root string, id uint64) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		s.watchFallback(ctx, id, err.Error())
		return
	}
	defer w.Close()
	refresh := func() {
		want := map[string]bool{}
		_ = filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if !e.IsDir() {
				return nil
			}
			if p != root && strings.HasPrefix(e.Name(), ".") {
				return fs.SkipDir
			}
			want[p] = true
			return nil
		})
		for _, p := range w.WatchList() {
			if !want[p] {
				_ = w.Remove(p)
			} else {
				delete(want, p)
			}
		}
		for p := range want {
			if e := w.Add(p); e != nil {
				s.watchWarning(id, e.Error())
			}
		}
	}
	refresh()
	// Cover changes between the initial index scan and watcher registration.
	s.refresh(id)
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	timer := time.NewTimer(time.Hour)
	timer.Stop()
	defer timer.Stop()
	var pending <-chan time.Time
	for {
		select {
		case <-ctx.Done():
			return
		case _, ok := <-w.Events:
			if !ok {
				return
			}
			timer.Reset(120 * time.Millisecond)
			pending = timer.C
		case e, ok := <-w.Errors:
			if !ok {
				return
			}
			s.watchWarning(id, e.Error())
			s.refresh(id)
		case <-pending:
			pending = nil
			s.refresh(id)
			refresh()
		case <-ticker.C:
			s.refresh(id)
			refresh()
		}
	}
}
func (s *Service) refresh(id uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.check(id) != nil {
		return
	}
	if err := s.reconcile(); err != nil {
		s.state.Warnings = []string{err.Error()}
		s.state.Version++
	}
}
func (s *Service) watchWarning(id uint64, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state.ID == id {
		s.state.Warnings = append(s.state.Warnings, "Watcher: "+message)
		s.state.Version++
	}
}
func (s *Service) watchFallback(ctx context.Context, id uint64, message string) {
	s.watchWarning(id, message+"; using periodic reconciliation")
	t := time.NewTicker(5 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.refresh(id)
		}
	}
}
