package workspace

import (
	"context"
	"errors"
	"time"
)

// OpenStore installs a document-provider workspace without interpreting its
// identity (a persisted tree URI on Android) as a filesystem path. Validate the
// complete initial scan before retiring the current workspace.
func OpenStore(s *Service, identity, name string, store Store) (Snapshot, error) {
	return openStore(s, identity, name, store, false)
}

// OpenUnavailableStore is used only when restoring a persisted provider grant.
// It keeps the workspace identity and a visible reconnect error, never a false
// empty-success snapshot that Sync could interpret as mass deletion.
func OpenUnavailableStore(s *Service, identity, name string, store Store) (Snapshot, error) {
	return openStore(s, identity, name, store, true)
}
func openStore(s *Service, identity, name string, store Store, allowUnavailable bool) (Snapshot, error) {
	if identity == "" || store == nil {
		return Snapshot{}, errors.New("workspace identity and storage are required")
	}
	next := NewService()
	next.store = store
	next.state.Name = name
	if err := next.reconcile(); err != nil {
		if !allowUnavailable {
			return Snapshot{}, err
		}
		next.state.Warnings = []string{err.Error()}
	}
	if len(next.state.Warnings) > 0 && !allowUnavailable {
		return Snapshot{}, errors.New(next.state.Warnings[0])
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
	if s.disk != nil {
		s.disk.Close()
	}
	s.disk = nil
	s.store, s.root, s.notes = store, identity, next.notes
	next.state.ID = s.state.ID + 1
	next.state.Version = s.state.Version + 1
	next.state.Key = Revision([]byte(identity))
	s.state = next.state
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	go s.pollProvider(ctx, s.state.ID)
	return s.state, nil
}

func (s *Service) pollProvider(ctx context.Context, id uint64) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.mu.Lock()
			provider, ok := s.store.(interface{ PollReady() bool })
			ready := s.state.ID == id && (!ok || provider.PollReady())
			s.mu.Unlock()
			if ready {
				s.refresh(id)
			}
		}
	}
}

// Refresh checks a provider before Sync treats a missing entry as a deletion.
// On any failure the last complete listing is kept, and Sync sees the warning.
func (s *Service) Refresh(id uint64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return err
	}
	if err := s.reconcile(); err != nil {
		s.state.Warnings = []string{err.Error()}
		s.state.Version++
		return err
	}
	return nil
}
