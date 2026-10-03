package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCalendarPlacesRepeaterHistoryOnScheduledDay(t *testing.T) {
	dir := t.TempDir()
	source := "* TODO Weekly review\nSCHEDULED: <2026-10-06 Tue 09:00-10:00 +1w>\n:LOGBOOK:\n- State \"DONE\" from \"TODO\" [2026-10-02 Fri 16:45] ; occurrence SCHEDULED: [2026-09-29 Tue 09:00-10:00]\n- State \"DONE\" from \"TODO\" [2026-09-24 Thu 15:00]\n:END:\n"
	if err := os.WriteFile(filepath.Join(dir, "review.org"), []byte(source), 0644); err != nil {
		t.Fatal(err)
	}
	s := NewService()
	defer s.Close()
	snap, err := s.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := s.Calendar(snap.ID)
	if err != nil || len(entries) != 2 {
		t.Fatalf("calendar: %+v %v", entries, err)
	}
	for _, entry := range entries {
		if entry.Done {
			if entry.Stamp.Date != "2026-09-29" || entry.Stamp.Time != "09:00" || entry.Stamp.EndTime != "10:00" || entry.Stamp.Kind != "completed" {
				t.Fatalf("completed occurrence: %+v", entry)
			}
		} else if entry.Stamp.Date != "2026-10-06" || entry.Stamp.Repeater != "+1w" {
			t.Fatalf("pending occurrence: %+v", entry)
		}
	}
}
