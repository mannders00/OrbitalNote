package workspace

import (
	"errors"
	"github.com/mannders00/OrbitalNote/internal/orgdoc"
)

// Edit operates on an unsaved buffer. Saving is a separate revision-checked step.
func (s *Service) Edit(source string, line int, operation, value string) (string, error) {
	if len(source) > MaxFileSize {
		return "", errors.New("document exceeds 8 MiB")
	}
	return orgdoc.EditHeading(source, line, operation, value)
}

func (s *Service) Reschedule(id uint64, p, revision string, start, end int, date string) (Note, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return Note{}, err
	}
	b, err := s.store.Read(p)
	if err != nil {
		return Note{}, err
	}
	if Revision(b) != revision {
		return Note{}, ErrConflict
	}
	source, err := orgdoc.MoveTimestamp(string(b), start, end, date)
	if err != nil {
		return Note{}, err
	}
	rev, err := s.store.Write(p, []byte(source), revision)
	if err != nil {
		return Note{}, err
	}
	note := Note{Path: p, Revision: rev, Document: orgdoc.Parse(source)}
	s.notes[p] = note
	s.state.Version++
	return note, nil
}
