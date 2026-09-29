package orgdoc

import (
	"strings"
	"testing"
)

func TestCalendarTimeEdits(t *testing.T) {
	source := "* TODO Plan\r\nDEADLINE: <2026-09-29 Tue 09:00-10:00 +1w -2d>\r\nUnrelated text\r\n"
	for _, tc := range []struct{ value, want string }{
		{`{"date":"2026-09-30","time":"11:15","endTime":"12:45"}`, "<2026-09-30 Wed 11:15-12:45 +1w -2d>"},
		{`{"date":"2026-09-30","time":"","endTime":""}`, "<2026-09-30 Wed +1w -2d>"},
	} {
		stamp := Parse(source).Headings[0].Dates[0]
		got, err := MoveTimestamp(source, stamp.Start, stamp.End, tc.value)
		if err != nil || got != strings.Replace(source, stamp.Raw, tc.want, 1) {
			t.Fatalf("%q: %q, %v", tc.value, got, err)
		}
	}
	stamp := Parse(source).Headings[0].Dates[0]
	for _, value := range []string{`{"date":"2026-09-30","time":"12:00","endTime":"11:00"}`, `{"date":"2026-09-30","time":"24:30"}`} {
		if _, err := MoveTimestamp(source, stamp.Start, stamp.End, value); err == nil {
			t.Fatal("accepted invalid range")
		}
	}
}
