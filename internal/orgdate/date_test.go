package orgdate

import (
	"testing"
	"time"
)

func TestCivilDatesAndTimes(t *testing.T) {
	for _, zone := range []string{"America/New_York", "Pacific/Auckland", "Europe/Berlin"} {
		t.Run(zone, func(t *testing.T) {
			loc, err := time.LoadLocation(zone)
			if err != nil {
				t.Fatal(err)
			}
			old := time.Local
			time.Local = loc
			defer func() { time.Local = old }()
			got := Parse("SCHEDULED: <2026-03-08 Sun 01:30-03:30> DEADLINE: <2026-11-01 Sun>")
			if len(got) != 2 || got[0].Date != "2026-03-08" || got[0].Time != "01:30" || got[0].EndTime != "03:30" || got[0].Kind != "scheduled" || got[1].Kind != "deadline" {
				t.Fatalf("wrong civil dates: %+v", got)
			}
		})
	}
}
func TestRangesRepeatersAndInvalidInput(t *testing.T) {
	s := "é <2026-09-24 Thu>--<2026-09-26 Sat> [2026-09-23 Wed] <2026-09-24 Thu ++2w> <2026-09-24 Thu .+1m>"
	got := Parse(s)
	if len(got) != 4 || got[0].EndDate != "2026-09-26" || got[1].Active || got[2].Repeater != "++2w" || got[3].Repeater != ".+1m" {
		t.Fatalf("unexpected: %+v", got)
	}
	for _, st := range got {
		if s[st.Start:st.End] != st.Raw {
			t.Fatal("offsets are not byte-exact")
		}
	}
	for _, invalid := range []string{"<2025-02-29 Sat>", "<2026-04-31>", "<2026-09-24 25:00>", "<2026-09-24 10:70>", "<2026-09-24]"} {
		if len(Parse(invalid)) != 0 {
			t.Errorf("accepted %q", invalid)
		}
	}
	if len(Parse("<2024-02-29 Thu>")) != 1 {
		t.Fatal("valid leap date rejected")
	}
}
