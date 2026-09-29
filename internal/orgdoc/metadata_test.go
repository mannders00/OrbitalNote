package orgdoc

import (
	"strings"
	"testing"
)

func TestMetadataEditsPreserveOtherSource(t *testing.T) {
	source := "#+TODO: NEXT | FINISHED\r\n* NEXT [#B] Title :old:\r\nSCHEDULED: <2026-09-28 Mon>\r\n:PROPERTIES:\r\n:ID: unchanged\r\n:Owner: someone\r\n:END:\r\nUnknown syntax stays.\r\n** Child :keep:\r\nBody\r\n"
	tests := []struct{ op, value, before, after string }{
		{"tags", "new work new", " :old:", " :new:work:"},
		{"priority", "A", "[#B]", "[#A]"},
		{"property", `{"name":"owner","value":"new person"}`, ":Owner: someone\r\n", ":OWNER: new person\r\n"},
		{"property", `{"name":"owner","remove":true}`, ":Owner: someone\r\n", ""},
		{"property", `{"name":"CATEGORY","value":"work"}`, ":END:", ":CATEGORY: work\r\n:END:"},
	}
	for _, tt := range tests {
		t.Run(tt.op+tt.value, func(t *testing.T) {
			got, err := EditHeading(source, 3, tt.op, tt.value)
			if err != nil {
				t.Fatal(err)
			}
			want := strings.Replace(source, tt.before, tt.after, 1)
			if got != want {
				t.Fatalf("got %q, want %q", got, want)
			}
		})
	}
}

func TestNewPropertyDrawerAndValidation(t *testing.T) {
	got, err := EditHeading("* TODO Title", 1, "property", `{"name":"CUSTOM_ID","value":"anchor"}`)
	if err != nil || got != "* TODO Title\n:PROPERTIES:\n:CUSTOM_ID: anchor\n:END:\n" {
		t.Fatalf("%q %v", got, err)
	}
	for _, value := range []string{`{"name":"END","value":"bad"}`, `{"name":"x","value":"bad\nline"}`} {
		if _, err := EditHeading("* TODO Title\n", 1, "property", value); err == nil {
			t.Fatal("accepted invalid property", value)
		}
	}
}
