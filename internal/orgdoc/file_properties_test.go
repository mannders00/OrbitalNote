package orgdoc

import "testing"

func TestFileProperties(t *testing.T) {
	for _, eol := range []string{"\n", "\r\n"} {
		body := "#+title: Notebook" + eol + "* Heading" + eol + ":PROPERTIES:" + eol + ":OWNER: Heading owner" + eol + ":END:" + eol + "Body" + eol
		source := "# Comment" + eol + eol + body
		added, err := EditHeading(source, 0, "file-property", `{"name":"owner","value":"File owner"}`)
		want := "# Comment" + eol + eol + ":PROPERTIES:" + eol + ":OWNER: File owner" + eol + ":END:" + eol + body
		if err != nil || added != want {
			t.Fatalf("add: %q, %v", added, err)
		}
		doc := Parse(added)
		if doc.Properties["OWNER"] != "File owner" || doc.Headings[0].Properties["OWNER"] != "Heading owner" {
			t.Fatalf("scopes: %+v", doc)
		}
		edited, err := EditHeading(added, 0, "file-property", `{"name":"OWNER","value":"New owner"}`)
		if err != nil || Parse(edited).Properties["OWNER"] != "New owner" {
			t.Fatalf("edit: %q, %v", edited, err)
		}
		removed, err := EditHeading(edited, 0, "file-property", `{"name":"OWNER","remove":true}`)
		if err != nil || len(Parse(removed).Properties) != 0 || Parse(removed).Headings[0].Properties["OWNER"] != "Heading owner" {
			t.Fatalf("remove: %q, %v", removed, err)
		}
	}
	for _, source := range []string{":PROPERTIES:\n:OWNER: One\n:OWNER: Two\n:END:\n", ":PROPERTIES:\n:OWNER: One\n* Heading\n"} {
		if _, err := EditHeading(source, 0, "file-property", `{"name":"OWNER","value":"New"}`); err == nil {
			t.Fatal("expected malformed/duplicate drawer error")
		}
	}
}
