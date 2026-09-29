package orgdoc

import (
	"strings"
	"testing"
)

func TestSubtreeEditsPreserveUnknownSyntax(t *testing.T) {
	source := "#+TITLE: Untouched\r\n* TODO One\r\n#+UNKNOWN: opaque\r\n** Child\r\n:ODD:\r\nx\r\n:END:\r\n* TODO Two\r\nbody\r\n"
	out, err := EditHeading(source, 2, "move-down", "")
	if err != nil {
		t.Fatal(err)
	}
	want := "#+TITLE: Untouched\r\n* TODO Two\r\nbody\r\n* TODO One\r\n#+UNKNOWN: opaque\r\n** Child\r\n:ODD:\r\nx\r\n:END:\r\n"
	if out != want {
		t.Fatalf("move changed bytes:\n%q", out)
	}
	out, err = EditHeading(out, 4, "move-up", "")
	if err != nil || out != source {
		t.Fatalf("round trip: %v %q", err, out)
	}
	out, err = EditHeading(source, 2, "demote", "")
	if err != nil {
		t.Fatal(err)
	}
	if out != strings.Replace(strings.Replace(source, "* TODO One", "** TODO One", 1), "** Child", "*** Child", 1) {
		t.Fatal("demote did not preserve subtree")
	}
	out, err = EditHeading(source, 2, "todo", "")
	if err != nil || !strings.Contains(out, "CLOSED: [") || setClosed(out, 2, false) != strings.Replace(source, "TODO One", "DONE One", 1) {
		t.Fatalf("TODO: %q %v", out, err)
	}
}
func TestPlanningEditAndGuardedDrag(t *testing.T) {
	source := "* TODO é task\r\nSCHEDULED: <2026-09-24 Thu 09:00-10:00>\r\n#+CUSTOM: untouched\r\n"
	d := Parse(source)
	st := d.Headings[0].Dates[0]
	out, err := MoveTimestamp(source, st.Start, st.End, "2026-09-26")
	if err != nil {
		t.Fatal(err)
	}
	if out != strings.Replace(source, "2026-09-24 Thu", "2026-09-26 Sat", 1) {
		t.Fatalf("modified unrelated source: %q", out)
	}
	out, err = EditHeading(source, 1, "deadline", "2026-09-30")
	if err != nil || !strings.Contains(out, "DEADLINE: <2026-09-30>\r\nSCHEDULED:") {
		t.Fatalf("planning insertion: %q %v", out, err)
	}
	if _, err = MoveTimestamp(source, st.Start, st.End, "2026-02-30"); err == nil {
		t.Fatal("invalid date accepted")
	}
	for _, raw := range []string{"<2026-09-24 Thu +1w>", "<2026-09-24 Thu>--<2026-09-26 Sat>"} {
		s := "* Task\n" + raw + "\n"
		st := Parse(s).Headings[0].Dates[0]
		if _, err := MoveTimestamp(s, st.Start, st.End, "2026-09-28"); err == nil {
			t.Fatal("ambiguous stamp moved")
		}
	}
}
