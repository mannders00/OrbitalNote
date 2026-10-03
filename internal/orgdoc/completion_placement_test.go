package orgdoc

import (
	"strings"
	"testing"
)

func TestCompletionMetadataBeforeProse(t *testing.T) {
	for _, eol := range []string{"\n", "\r\n"} {
		for _, repeat := range []string{"", " +1w"} {
			for _, properties := range []string{"", ":PROPERTIES:\n:ID: review\n:END:\n"} {
				body := "\nMy paragraph with trailing spaces.  \n\nAnother paragraph.\n** Child\nKeep this."
				source := strings.ReplaceAll("* TODO Review\nSCHEDULED: <2026-09-29 Tue"+repeat+">\n"+properties+body, "\n", eol)
				out, err := EditHeading(source, 1, "complete", "")
				if err != nil {
					t.Fatal(err)
				}
				if !strings.HasSuffix(out, strings.ReplaceAll(body, "\n", eol)) {
					t.Fatalf("body changed or metadata appended after prose: %q", out)
				}
				h := Parse(out).Headings[0]
				if repeat == "" {
					if !h.Done || !strings.HasPrefix(out, "* DONE Review"+eol+"CLOSED:") {
						t.Fatalf("ordinary completion not persisted: %q", out)
					}
				} else {
					if h.State != "TODO" || len(h.History) != 1 || !strings.Contains(out, ":LOGBOOK:"+eol+"- State \"DONE\"") {
						t.Fatalf("repeated completion not recorded: %q", out)
					}
					if properties != "" && !strings.Contains(out, ":ID: review"+eol+":END:"+eol+":LOGBOOK:") {
						t.Fatalf("logbook must follow properties: %q", out)
					}
				}
			}
		}
	}
}

func TestNewClockLogbookBeforeProse(t *testing.T) {
	for _, source := range []string{"* TODO Review", "* TODO Review\nParagraph.\n** Child\nUntouched"} {
		out, err := EditHeading(source, 1, "clock-in", "")
		if err != nil || !strings.HasPrefix(out, "* TODO Review\n:LOGBOOK:\nCLOCK:") {
			t.Fatalf("clock placement: %q, %v", out, err)
		}
		if strings.Contains(source, "Paragraph") && !strings.HasSuffix(out, ":END:\nParagraph.\n** Child\nUntouched") {
			t.Fatalf("body changed: %q", out)
		}
	}
}
