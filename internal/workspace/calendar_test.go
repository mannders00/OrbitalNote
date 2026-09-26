package workspace

import "testing"

func TestCalendarRetainsCompletedTimeBlocks(t *testing.T) {
	s := NewService()
	defer s.Close()
	state, err := s.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.Save(state.ID, "calendar.org", "#+TODO: NEXT | FINISHED\n* FINISHED Meeting\nSCHEDULED: <2026-09-26 09:30-11:00>\n* NEXT Follow up\nSCHEDULED: <2026-09-26 12:00>\n", "")
	if err != nil {
		t.Fatal(err)
	}
	calendar, err := s.Calendar(state.ID)
	if err != nil || len(calendar) != 2 {
		t.Fatalf("calendar: %+v %v", calendar, err)
	}
	if !calendar[0].Done || calendar[0].Stamp.Time != "09:30" || calendar[0].Stamp.EndTime != "11:00" {
		t.Fatalf("lost completed block: %+v", calendar[0])
	}
	agenda, err := s.Agenda(state.ID)
	if err != nil || len(agenda) != 1 || agenda[0].Done {
		t.Fatalf("agenda: %+v %v", agenda, err)
	}
}
