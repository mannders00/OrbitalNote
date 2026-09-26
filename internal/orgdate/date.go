// Package orgdate interprets Org timestamps without converting civil dates to UTC.
package orgdate

import (
	"regexp"
	"strings"
	"time"
)

type Stamp struct {
	Date     string `json:"date"`
	Time     string `json:"time,omitempty"`
	EndTime  string `json:"endTime,omitempty"`
	EndDate  string `json:"endDate,omitempty"`
	Active   bool   `json:"active"`
	Kind     string `json:"kind"`
	Repeater string `json:"repeater,omitempty"`
	Raw      string `json:"raw"`
	Start    int    `json:"start"`
	End      int    `json:"end"`
}

var stampRE = regexp.MustCompile(`([<\[])(\d{4}-\d{2}-\d{2})(?:\s+[A-Za-z]+)?(?:\s+(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?)?(?:\s+((?:\+\+|\.\+|\+)\d+[hdwmy]))?(?:\s+-\d+[hdwmy])?([>\]])`)

func ValidDate(s string) bool { _, err := time.Parse("2006-01-02", s); return err == nil }
func validTime(s string) bool {
	if s == "" {
		return true
	}
	_, err := time.Parse("15:04", s)
	return err == nil
}

// Parse returns validated stamps with byte offsets into s. Invalid dates remain text.
func Parse(s string) []Stamp {
	out := []Stamp{}
	for _, idx := range stampRE.FindAllStringSubmatchIndex(s, -1) {
		get := func(n int) string {
			if idx[2*n] < 0 {
				return ""
			}
			return s[idx[2*n]:idx[2*n+1]]
		}
		if !ValidDate(get(2)) || !validTime(get(3)) || !validTime(get(4)) {
			continue
		}
		if (get(1) == "<") != (get(6) == ">") {
			continue
		}
		st := Stamp{Date: get(2), Time: get(3), EndTime: get(4), Active: get(1) == "<", Repeater: get(5), Kind: "event", Raw: s[idx[0]:idx[1]], Start: idx[0], End: idx[1]}
		prefix := strings.TrimRight(s[:idx[0]], " \t")
		if strings.HasSuffix(prefix, "SCHEDULED:") {
			st.Kind = "scheduled"
		}
		if strings.HasSuffix(prefix, "DEADLINE:") {
			st.Kind = "deadline"
		}
		if len(out) > 0 && s[out[len(out)-1].End:st.Start] == "--" && out[len(out)-1].Active == st.Active && st.Date >= out[len(out)-1].Date {
			prev := &out[len(out)-1]
			prev.EndDate = st.Date
			prev.EndTime = st.Time
			prev.End = st.End
			prev.Raw = s[prev.Start:prev.End]
			continue
		}
		out = append(out, st)
	}
	return out
}
