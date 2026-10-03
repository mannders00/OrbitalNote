package orgdoc

import (
	"strings"
	"testing"
)

func TestPreviewKeepsOrgNoteLinks(t *testing.T) {
	doc := Parse("* Links\n[[file:Architecture.org][architecture]]\n[[../Journal.org]]\n[[file:Decisions/Queue.org::*Tradeoff][decision]]\n[[https://example.org/page.org][external]]\n[[file:manual.html][manual]]\n")
	for _, href := range []string{"Architecture.org", "../Journal.org", "Decisions/Queue.org::*Tradeoff", "https://example.org/page.org", "manual.html"} {
		if !strings.Contains(doc.HTML, `href="`+href+`"`) {
			t.Errorf("missing original link %q in %s", href, doc.HTML)
		}
	}
	if strings.Contains(doc.HTML, "Architecture.html") || strings.Contains(doc.HTML, "Journal.html") {
		t.Fatal("preview rewrote an Org note to HTML")
	}
}
