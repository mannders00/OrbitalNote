package orgdoc

import (
	"strings"
	"testing"
)

func TestTaskEditPreservesSubtreeAndTimes(t *testing.T) {
	source := "#+TODO: NEXT | FINISHED\r\n* [#A] *Raw title* :work:\r\n:PROPERTIES:\r\n:ID: stable\r\n:END:\r\nBody stays.\n** Child\nChild body\n"
	got, err := EditHeading(source, 6, "task", `{"title":"*New title*","date":"2026-09-26","time":"09:30","endTime":"11:00","kind":"scheduled"}`)
	if err != nil {
		t.Fatal(err)
	}
	want := "#+TODO: NEXT | FINISHED\r\n* NEXT [#A] *New title* :work:\r\nSCHEDULED: <2026-09-26 09:30-11:00>\r\n:PROPERTIES:\r\n:ID: stable\r\n:END:\r\nBody stays.\n** Child\nChild body\n"
	if got != want {
		t.Fatalf("unexpected source:\n%q\nwant:\n%q", got, want)
	}
	completed, err := EditHeading(got, 2, "complete", "")
	if err != nil || !strings.Contains(completed, "* FINISHED [#A]") {
		t.Fatalf("complete: %q %v", completed, err)
	}
	reopened, err := EditHeading(completed, 2, "complete", "")
	if err != nil || reopened != got {
		t.Fatalf("reopen: %q %v", reopened, err)
	}
}

func TestTaskValidationAndExistingStamp(t *testing.T) {
	source := "* TODO Meeting\nSCHEDULED: <2026-09-26 Sat 09:00-10:00> DEADLINE: <2026-10-01 Thu>\nUntouched body\n"
	got, err := EditHeading(source, 1, "task", `{"title":"Meeting","date":"2026-09-27","time":"13:00","endTime":"14:30","kind":"scheduled"}`)
	if err != nil || !strings.Contains(got, "SCHEDULED: <2026-09-27 13:00-14:30> DEADLINE: <2026-10-01 Thu>\nUntouched body") {
		t.Fatalf("edit: %q %v", got, err)
	}
	for _, value := range []string{
		`{"title":"Meeting","date":"2026-02-30","kind":"scheduled"}`,
		`{"title":"Meeting","date":"2026-09-26","time":"25:00","kind":"scheduled"}`,
		`{"title":"Meeting","date":"2026-09-26","time":"11:00","endTime":"10:00","kind":"scheduled"}`,
		`{"title":"Meeting","time":"11:00","kind":"scheduled"}`,
	} {
		if _, err := EditHeading(source, 1, "task", value); err == nil {
			t.Errorf("accepted invalid task %s", value)
		}
	}
}

func TestTaskChangesPlanningTypeWithoutDuplicatingStamp(t *testing.T) {
	source := "* TODO Meeting\nSCHEDULED: <2026-09-26 09:00-10:00>\nBody\n"
	got, err := EditHeading(source, 1, "task", `{"title":"Meeting","date":"2026-09-27","time":"13:00","endTime":"14:30","kind":"deadline","previousKind":"scheduled"}`)
	if err != nil {
		t.Fatal(err)
	}
	want := "* TODO Meeting\nDEADLINE: <2026-09-27 13:00-14:30>\nBody\n"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
