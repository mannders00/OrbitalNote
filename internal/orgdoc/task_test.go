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

func TestEventDateEditing(t *testing.T) {
	for _, test := range []struct{ name, source, edit, want string }{
		{"plain heading", "* Event\nNotes\n", `{"title":"Event","date":"2026-10-18","time":"10:00","endTime":"11:00","kind":"event"}`, "* Event\n<2026-10-18 10:00-11:00>\nNotes\n"},
		{"existing TODO", "* TODO Event\n", `{"title":"Event","date":"2026-10-18","kind":"event"}`, "* TODO Event\n<2026-10-18>\n"},
		{"drawer and CRLF", "* [#A] Event :work:\r\n:PROPERTIES:\r\n:ID: keep\r\n:END:\r\nBody\n** Child\n", `{"title":"Event","date":"2026-10-18","kind":"event"}`, "* [#A] Event :work:\r\n:PROPERTIES:\r\n:ID: keep\r\n:END:\r\n<2026-10-18>\r\nBody\n** Child\n"},
		{"convert planning", "* TODO Event\nSCHEDULED: <2026-10-17>\n:PROPERTIES:\n:ID: keep\n:END:\nBody\n", `{"title":"Event","date":"2026-10-18","kind":"event","previousKind":"scheduled"}`, "* TODO Event\n:PROPERTIES:\n:ID: keep\n:END:\n<2026-10-18>\nBody\n"},
		{"preserve other planning", "* TODO Event\nSCHEDULED: <2026-10-17> DEADLINE: <2026-10-20>\nBody\n", `{"title":"Event","date":"2026-10-18","kind":"event","previousKind":"scheduled"}`, "* TODO Event\n DEADLINE: <2026-10-20>\n<2026-10-18>\nBody\n"},
		{"edit active not inactive", "* Event\n[2026-10-01 Thu]\n<2026-10-18 Sun 10:00-11:00>\n", `{"title":"Event","date":"2026-10-19","time":"12:00","endTime":"13:00","kind":"event"}`, "* Event\n[2026-10-01 Thu]\n<2026-10-19 12:00-13:00>\n"},
		{"remove date", "* Event\n<2026-10-18>\nNotes\n", `{"title":"Event","kind":"event"}`, "* Event\n\nNotes\n"},
		{"convert event to deadline", "* Event\n<2026-10-18>\n", `{"title":"Event","date":"2026-10-20","kind":"deadline","previousKind":"event"}`, "* TODO Event\nDEADLINE: <2026-10-20>\n"},
		{"convert event after properties", "* Event\n:PROPERTIES:\n:ID: keep\n:END:\n<2026-10-18>\nBody\n", `{"title":"Event","date":"2026-10-20","kind":"scheduled","previousKind":"event"}`, "* TODO Event\nSCHEDULED: <2026-10-20>\n:PROPERTIES:\n:ID: keep\n:END:\nBody\n"},
		{"no final newline", "* Event", `{"title":"Event","date":"2026-10-18","kind":"event"}`, "* Event\n<2026-10-18>\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := EditHeading(test.source, 1, "task", test.edit)
			if err != nil {
				t.Fatal(err)
			}
			if got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}

func TestEventDateRejectsAmbiguousAndInvalidEdits(t *testing.T) {
	for _, test := range []struct{ source, edit string }{
		{"* Event\n<2026-10-18>\n<2026-10-19>\n", `{"title":"Event","date":"2026-10-20","kind":"event"}`},
		{"* Event\nSCHEDULED: <2026-10-17>\n<2026-10-18>\n", `{"title":"Event","date":"2026-10-20","kind":"event","previousKind":"scheduled"}`},
		{"* Event\n", `{"title":"Event","date":"2026-02-30","kind":"event"}`},
		{"* Event\n", `{"title":"Event","date":"2026-10-18","time":"11:00","endTime":"10:00","kind":"event"}`},
	} {
		if _, err := EditHeading(test.source, 1, "task", test.edit); err == nil {
			t.Fatalf("accepted invalid event edit %s", test.edit)
		}
	}
}
