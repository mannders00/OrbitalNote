package orgdoc

import (
	"strings"
	"testing"
	"time"
)

func TestCompletedRepeaterKeepsScheduledOccurrence(t *testing.T) {
	for _, tc := range []struct{ name, repeat, completed, next string }{
		{"early", "+1w", "2026-09-28", "2026-10-06"},
		{"late", "+1w", "2026-10-02", "2026-10-06"},
		{"catch-up", "++1w", "2026-10-10", "2026-10-13"},
		{"restart", ".+1w", "2026-10-10", "2026-10-17"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			source := "* TODO Review\r\nSCHEDULED: <2026-09-29 Tue 09:00-10:00 " + tc.repeat + ">\r\n:LOGBOOK:\r\n- Existing note\r\n:END:\r\n** Child\r\nuntouched\r\n"
			now, _ := time.Parse("2006-01-02 15:04", tc.completed+" 16:45")
			out, repeated, err := completeRepeaterAt(source, Parse(source).Headings[0], "DONE", now)
			if err != nil || !repeated {
				t.Fatalf("completion: %v %v", repeated, err)
			}
			h := Parse(out).Headings[0]
			if len(h.History) != 1 || h.History[0].Date != "2026-09-29" || h.History[0].Time != "09:00" || h.History[0].EndTime != "10:00" || h.Dates[0].Date != tc.next {
				t.Fatalf("wrong occurrence or next date: %+v", h)
			}
			if !strings.Contains(out, "["+now.Format("2006-01-02 Mon 15:04")+"] ; occurrence SCHEDULED: [2026-09-29 Tue 09:00-10:00]\r\n") || !strings.HasSuffix(out, "- Existing note\r\n:END:\r\n** Child\r\nuntouched\r\n") {
				t.Fatalf("completion time or unrelated source changed: %s", out)
			}
		})
	}
}

func TestRepeaterHistoryRetainsBothPlanningDates(t *testing.T) {
	source := "* TODO Report\nSCHEDULED: <2026-09-28 Mon +1w> DEADLINE: <2026-09-30 Wed +1w>\n"
	out, _, err := completeRepeaterAt(source, Parse(source).Headings[0], "DONE", time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	history := Parse(out).Headings[0].History
	if len(history) != 2 || history[0].Date != "2026-09-28" || history[1].Date != "2026-09-30" || history[0].Time != "" {
		t.Fatalf("history: %+v", history)
	}
}

func TestLegacyCompletionLogDoesNotInventScheduledDates(t *testing.T) {
	source := "* TODO Review\nSCHEDULED: <2026-10-06 Tue +1w>\n:LOGBOOK:\n- State \"DONE\" from \"TODO\" [2026-10-02 Fri 16:45]\n:END:\n"
	doc := Parse(source)
	if len(doc.Headings[0].History) != 0 || doc.Source != source {
		t.Fatal("legacy completion should stay in source without becoming a calendar occurrence")
	}
}
