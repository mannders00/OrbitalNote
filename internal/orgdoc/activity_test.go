package orgdoc

import (
	"strings"
	"testing"
	"time"
)

func TestClockRoundTripAndCompletion(t *testing.T) {
	source := "* TODO Work\r\nSCHEDULED: <2026-09-29 Tue>\r\n:PROPERTIES:\r\n:ID: stable\r\n:END:\r\nBody.\r\n** Child\r\nunchanged\r\n"
	active, err := EditHeading(source, 1, "clock-in", "")
	if err != nil {
		t.Fatal(err)
	}
	doc := Parse(active)
	if doc.Headings[0].Clock == "" || doc.Headings[0].Properties["ID"] != "stable" {
		t.Fatalf("clock/property parse: %+v", doc.Headings[0])
	}
	twice, err := EditHeading(active, 1, "clock-in", "")
	if err != nil || twice != active {
		t.Fatal("clock-in must be idempotent")
	}
	done, err := EditHeading(active, 1, "complete", "")
	if err != nil {
		t.Fatal(err)
	}
	h := Parse(done).Headings[0]
	if !h.Done || h.Clock != "" || !strings.Contains(done, "CLOSED: [") || !strings.Contains(done, "] => ") {
		t.Fatal(done)
	}
	if !strings.HasSuffix(done, "** Child\r\nunchanged\r\n") || !strings.Contains(done, ":ID: stable\r\n") {
		t.Fatal("modified unrelated source")
	}
	reopened, err := EditHeading(done, 1, "complete", "")
	if err != nil || strings.Contains(reopened, "CLOSED:") {
		t.Fatalf("reopen: %s %v", reopened, err)
	}
}

func TestRepeaterCompletionAndHistory(t *testing.T) {
	source := "#+TODO: NEXT | FINISHED\r\n* NEXT Weekly review\r\nSCHEDULED: <2026-09-29 Tue 09:00-10:00 +1w>\r\n:PROPERTIES:\r\n:ID: keep\r\n:END:\r\nBody\r\n** Child\r\nuntouched\r\n"
	out, err := EditHeading(source, 2, "complete", "")
	if err != nil {
		t.Fatal(err)
	}
	h := Parse(out).Headings[0]
	if h.Done || h.State != "NEXT" || h.Dates[0].Date != "2026-10-06" || len(h.History) != 1 {
		t.Fatalf("repeating completion: %+v\n%s", h, out)
	}
	if h.History[0].Kind != "completed" || !strings.Contains(out, `- State "FINISHED" from "NEXT"`) || !strings.HasSuffix(out, "** Child\r\nuntouched\r\n") {
		t.Fatal(out)
	}
	if h.Properties["ID"] != "keep" || strings.Contains(out, "CLOSED:") {
		t.Fatal(out)
	}
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct{ date, repeat, want string }{
		{"2026-01-31", "+1m", "2026-02-28"}, {"2026-09-01", "++1w", "2026-10-06"}, {"2026-09-01", ".+1w", "2026-10-06"},
	} {
		next, err := nextRepeat(tc.date, "", tc.repeat, now)
		if err != nil || next.Format("2006-01-02") != tc.want {
			t.Fatalf("%+v: %v %v", tc, next, err)
		}
	}
}

func TestCheckboxSourcePreservation(t *testing.T) {
	source := "* Task\r\n  - [ ] keep this\r\n  - [X] other\n"
	out, err := EditHeading(source, 2, "checkbox", "")
	if err != nil || out != strings.Replace(source, "[ ]", "[X]", 1) {
		t.Fatalf("%q %v", out, err)
	}
	out, err = EditHeading(out, 2, "checkbox", "")
	if err != nil || out != source {
		t.Fatal("checkbox round trip")
	}
}
