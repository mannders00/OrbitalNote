package orgdoc

import (
	"strings"
	"testing"
)

func TestGuidedFileMetadata(t *testing.T) {
	for _, eol := range []string{"\n", "\r\n"} {
		prefix := ":PROPERTIES:" + eol + ":ID: preserve-id" + eol + ":END:" + eol
		body := "#+begin_example" + eol + "#+TITLE: Example only" + eol + "#+end_example" + eol + "* TODO Heading" + eol + "#+TITLE: Not file metadata" + eol
		source := prefix + "#+TITLE: Old" + eol + "#+OPTIONS: toc:nil" + eol + body
		got, err := EditHeading(source, 0, "file-metadata", `{"TITLE":"New","FILETAGS":"work :research: work","AUTHOR":"Alex","CATEGORY":"Study"}`)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(got, prefix) || !strings.HasSuffix(got, body) || !strings.Contains(got, "#+FILETAGS: :work:research:"+eol) || !strings.Contains(got, "#+OPTIONS: toc:nil"+eol) {
			t.Fatalf("source damaged: %q", got)
		}
		doc := Parse(got)
		if doc.Metadata["TITLE"] != "New" || len(doc.FileTags) != 2 || doc.Properties["ID"] != "preserve-id" {
			t.Fatalf("metadata: %+v", doc)
		}
		again, err := EditHeading(got, 0, "file-metadata", `{"TITLE":"New","FILETAGS":"work research","AUTHOR":"Alex","CATEGORY":"Study"}`)
		if err != nil || again != got {
			t.Fatal("unchanged metadata should preserve source")
		}
		cleared, err := EditHeading(got, 0, "file-metadata", `{"TITLE":"","FILETAGS":""}`)
		if err != nil || Parse(cleared).Metadata["TITLE"] != "" || !strings.HasSuffix(cleared, body) {
			t.Fatalf("clear: %q %v", cleared, err)
		}
	}
	if _, err := EditHeading("* Note\n", 0, "file-metadata", `{"FILETAGS":"bad/tag"}`); err == nil {
		t.Fatal("invalid tag accepted")
	}
}
