package orgdoc

import (
	"strings"
	"testing"
)

func TestDeleteHeadingPreservesNestedContent(t *testing.T) {
	for _, eol := range []string{"\n", "\r\n"} {
		source := strings.ReplaceAll("#+TITLE: Tasks\n* TODO Parent\nSCHEDULED: <2026-11-11 Wed>\nParent body\n** TODO Child\nChild body\n*** Grandchild\nKeep this\n* Sibling\n", "\n", eol)
		want := strings.ReplaceAll("#+TITLE: Tasks\n** TODO Child\nChild body\n*** Grandchild\nKeep this\n* Sibling\n", "\n", eol)
		got, err := EditHeading(source, 3, "delete-heading", "")
		if err != nil || got != want {
			t.Fatalf("delete parent: %v\ngot %q\nwant %q", err, got, want)
		}
	}
	got, err := EditHeading("* Keep\nBody\n* Last\nLast body", 3, "delete-heading", "")
	if err != nil || got != "* Keep\nBody\n" {
		t.Fatalf("delete final heading: %v, %q", err, got)
	}
}
