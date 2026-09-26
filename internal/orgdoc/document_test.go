package orgdoc

import (
	"strings"
	"testing"
)

func TestSemanticsAndPreservation(t *testing.T) {
	source := "#+TODO: TODO NEXT WAIT | DONE CANCELLED\r\n* NEXT Ship it :work:release:\r\nSCHEDULED: <2026-09-24 Thu 09:00> DEADLINE: <2026-09-25 Fri>\r\n:PROPERTIES:\r\n:ID: abc-123\r\n:END:\r\n[[file:other.org][Other]]\r\n#+begin_src go\r\n* TODO not a heading\r\n<2026-01-01 Thu>\r\n#+end_src\r\n** DONE Child\r\n#+UNKNOWN: preserve me\r\n"
	d := Parse(source)
	if d.Source != source {
		t.Fatal("source changed")
	}
	if len(d.Headings) != 2 {
		t.Fatalf("headings: %+v", d.Headings)
	}
	h := d.Headings[0]
	if h.State != "NEXT" || h.Title != "Ship it" || h.Line != 2 || len(h.Tags) != 2 || h.Properties["ID"] != "abc-123" || len(h.Dates) != 2 {
		t.Fatalf("metadata: %+v", h)
	}
	if !d.Headings[1].Done || d.Headings[1].Parent != 0 {
		t.Fatalf("child: %+v", d.Headings[1])
	}
	if len(d.Links) != 1 || d.Links[0].Target != "file:other.org" {
		t.Fatalf("links: %+v", d.Links)
	}
}
func TestUntrustedExportAndLongLine(t *testing.T) {
	d := Parse("#+begin_export html\n<script>alert(1)</script><img src=https://tracker.example/x onerror=alert(2)><iframe src=file:///etc/passwd></iframe>\n#+end_export\n[[javascript:alert(1)][bad]]\n")
	for _, bad := range []string{"<script", "<iframe", "<img", "javascript:"} {
		if strings.Contains(d.HTML, bad) {
			t.Fatalf("unsafe output %s", d.HTML)
		}
	}
	source := "* Heading\n" + strings.Repeat("x", 70000)
	d = Parse(source)
	if d.Source != source || d.Warning == "" || !strings.Contains(d.HTML, "<pre>") {
		t.Fatal("long lines must remain editable with preview fallback")
	}
}
func TestIncludesCannotReadFiles(t *testing.T) {
	d := Parse("#+INCLUDE: \"/etc/passwd\"\n")
	if strings.Contains(d.HTML, "root:") {
		t.Fatal("include read filesystem")
	}
}

func TestRichPreviewIsInert(t *testing.T) {
	d := Parse("* Heading\n:PROPERTIES:\n:ID: stable\n:END:\n[[file:photo.png]]\n#+begin_src go\nfunc main() {}\n#+end_src\n")
	if !strings.Contains(d.HTML, "<summary>Properties</summary>") || !strings.Contains(d.HTML, "stable") {
		t.Fatalf("properties missing: %s", d.HTML)
	}
	if !strings.Contains(d.HTML, `data-org-image="photo.png"`) && !strings.Contains(d.HTML, `data-org-image="file:photo.png"`) {
		t.Fatalf("local image missing: %s", d.HTML)
	}
	if strings.Contains(d.HTML, "<img") {
		t.Fatal("image loaded without confined service")
	}
	if !strings.Contains(d.HTML, `class="kd"`) {
		t.Fatalf("code highlight missing: %s", d.HTML)
	}
}
