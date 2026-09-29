package orgdoc

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/mannders00/OrbitalNote/internal/orgdate"
)

type taskEdit struct {
	Title        string `json:"title"`
	Date         string `json:"date"`
	Time         string `json:"time"`
	EndTime      string `json:"endTime"`
	Kind         string `json:"kind"`
	PreviousKind string `json:"previousKind"`
	Repeater     string `json:"repeater"`
}

var taskTags = regexp.MustCompile(`\s+:[\w@#%:]+:\s*$`)
var taskPriority = regexp.MustCompile(`^\[#[^\]]+\]\s+`)

// Only the selected heading line and its planning stamp are spliced. Bodies,
// drawers, descendants, tags, priorities and unrelated timestamps stay intact.
func editTask(source string, h Heading, value string) (string, error) {
	var edit taskEdit
	if err := json.Unmarshal([]byte(value), &edit); err != nil {
		return "", errors.New("invalid task details")
	}
	if strings.TrimSpace(edit.Title) == "" || strings.ContainsAny(edit.Title, "\r\n") {
		return "", errors.New("task title must be a single non-empty line")
	}
	if edit.Kind != "scheduled" && edit.Kind != "deadline" {
		return "", errors.New("invalid planning type")
	}
	if edit.Date != "" && !orgdate.ValidDate(edit.Date) {
		return "", errors.New("invalid date")
	}
	if edit.Repeater != "" && (!repeatRE.MatchString(edit.Repeater) || edit.Date == "") {
		return "", errors.New("a repeater needs a date and an interval such as +1w")
	}
	if edit.Time != "" {
		if _, err := time.Parse("15:04", edit.Time); err != nil || edit.Date == "" {
			return "", errors.New("a start time requires a valid date and HH:MM time")
		}
	}
	if edit.EndTime != "" {
		if _, err := time.Parse("15:04", edit.EndTime); err != nil || edit.Time == "" || edit.EndTime <= edit.Time {
			return "", errors.New("end time must be later than start time")
		}
	}
	if edit.Repeater != "" {
		if _, err := nextRepeat(edit.Date, edit.Time, edit.Repeater, time.Now()); err != nil {
			return "", err
		}
	}
	lines := strings.SplitAfter(source, "\n")
	start := 0
	for _, line := range lines[:h.Line-1] {
		start += len(line)
	}
	raw := lines[h.Line-1]
	eol := "\n"
	if strings.HasSuffix(raw, "\r\n") {
		eol = "\r\n"
	}
	text := strings.TrimRight(raw, "\r\n")
	state := h.State
	if state == "" {
		ast := config().Parse(strings.NewReader(source), "")
		fields := strings.Fields(ast.Get("TODO"))
		state = "TODO"
		if len(fields) > 0 {
			state = strings.SplitN(fields[0], "(", 2)[0]
		}
	}
	titleStart := h.Level
	for titleStart < len(text) && (text[titleStart] == ' ' || text[titleStart] == '\t') {
		titleStart++
	}
	if h.State != "" {
		titleStart += len(h.State)
		for titleStart < len(text) && text[titleStart] == ' ' {
			titleStart++
		}
	}
	priority := taskPriority.FindString(text[titleStart:])
	tags := taskTags.FindString(text[titleStart:])
	newHeading := text[:h.Level] + " " + state + " " + priority + strings.TrimSpace(edit.Title) + tags
	if strings.HasSuffix(raw, "\n") {
		newHeading += eol
	}
	stamp := ""
	if edit.Date != "" {
		stamp = "<" + edit.Date
		if edit.Time != "" {
			stamp += " " + edit.Time
			if edit.EndTime != "" {
				stamp += "-" + edit.EndTime
			}
		}
		if edit.Repeater != "" {
			stamp += " " + edit.Repeater
		}
		stamp += ">"
	}
	var matching []orgdate.Stamp
	matchKind := edit.Kind
	if edit.PreviousKind != "" {
		if edit.PreviousKind != "scheduled" && edit.PreviousKind != "deadline" {
			return "", errors.New("invalid previous planning type")
		}
		matchKind = edit.PreviousKind
	}
	for _, date := range h.Dates {
		if date.Kind == edit.Kind && edit.Kind != matchKind {
			return "", errors.New("this heading already has that planning type")
		}
		if date.Kind == matchKind {
			matching = append(matching, date)
		}
	}
	if len(matching) > 1 {
		return "", errors.New("multiple planning timestamps; edit the source explicitly")
	}
	out := source
	if len(matching) == 1 {
		old := matching[0]
		if old.Start < start+len(raw) {
			return "", errors.New("edit timestamps inside the heading title directly")
		}
		if old.EndDate != "" {
			return "", errors.New("edit repeating or multi-day timestamps directly in the source")
		}
		at := old.Start
		if stamp == "" || edit.Kind != matchKind {
			prefix := strings.TrimRight(source[:at], " \t")
			if strings.HasSuffix(prefix, strings.ToUpper(matchKind)+":") {
				at = len(prefix) - len(matchKind) - 1
			}
			if stamp != "" {
				stamp = strings.ToUpper(edit.Kind) + ": " + stamp
			}
		}
		out = source[:at] + stamp + source[old.End:]
	} else if stamp != "" {
		bodyEnd := len(source)
		for _, next := range Parse(source).Headings {
			if next.Line > h.Line {
				bodyEnd = 0
				for _, line := range lines[:next.Line-1] {
					bodyEnd += len(line)
				}
				break
			}
		}
		if strings.Contains(source[start+len(raw):bodyEnd], strings.ToUpper(edit.Kind)+":") {
			return "", errors.New("existing planning syntax is unsupported; edit the source explicitly")
		}
		at := start + len(raw)
		prefix := ""
		if !strings.HasSuffix(raw, "\n") {
			prefix = eol
		}
		out = source[:at] + prefix + strings.ToUpper(edit.Kind) + ": " + stamp + eol + source[at:]
	}
	return out[:start] + newHeading + out[start+len(raw):], nil
}
