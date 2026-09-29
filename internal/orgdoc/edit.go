package orgdoc

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/mannders00/OrbitalNote/internal/orgdate"
)

// EditHeading applies an explicit command to source spans, never an AST export.
// line is one-based and may point into the heading's body.
func EditHeading(source string, line int, operation, value string) (string, error) {
	if operation == "file-property" {
		at := filePropertyStart(source)
		prefix := "* File\n"
		if strings.Contains(source, "\r\n") {
			prefix = "* File\r\n"
		}
		changed, err := editMetadata(prefix+source[at:], Heading{Line: 1}, "property", value)
		if err != nil {
			return "", err
		}
		return source[:at] + strings.TrimPrefix(changed, prefix), nil
	}
	if operation == "checkbox" {
		return toggleCheckbox(source, line)
	}
	d := Parse(source)
	if d.Warning != "" {
		return "", errors.New("structured edits require a successfully parsed document")
	}
	index := -1
	for i, h := range d.Headings {
		if h.Line > line {
			break
		}
		index = i
	}
	if index < 0 {
		return "", errors.New("place the cursor inside an Org heading")
	}
	h := d.Headings[index]
	lines := strings.SplitAfter(source, "\n")
	offsets := make([]int, len(lines)+1)
	for i, l := range lines {
		offsets[i+1] = offsets[i] + len(l)
	}
	start := offsets[h.Line-1]
	endIndex := len(d.Headings)
	for i := index + 1; i < len(d.Headings); i++ {
		if d.Headings[i].Level <= h.Level {
			endIndex = i
			break
		}
	}
	end := len(source)
	if endIndex < len(d.Headings) {
		end = offsets[d.Headings[endIndex].Line-1]
	}
	splice := func(a, b int, s string) string { return source[:a] + s + source[b:] }
	eol := "\n"
	if strings.Contains(lines[h.Line-1], "\r\n") {
		eol = "\r\n"
	}
	switch operation {
	case "clock-in", "clock-out":
		return editClock(source, h, operation)
	case "tags", "property", "priority":
		return editMetadata(source, h, operation, value)
	case "task":
		return editTask(source, h, value)
	case "promote", "demote":
		if operation == "promote" && h.Level == 1 {
			return "", errors.New("top-level headings cannot be promoted")
		}
		out := source
		for i := endIndex - 1; i >= index; i-- {
			at := offsets[d.Headings[i].Line-1]
			if operation == "promote" {
				out = out[:at] + out[at+1:]
			} else {
				out = out[:at] + "*" + out[at:]
			}
		}
		return out, nil
	case "todo", "complete":
		ast := config().Parse(strings.NewReader(source), "")
		states := []string{}
		for _, v := range strings.Fields(strings.ReplaceAll(ast.Get("TODO"), "|", " ")) {
			states = append(states, strings.SplitN(v, "(", 2)[0])
		}
		next := ""
		if operation == "complete" {
			sequence := strings.SplitN(ast.Get("TODO"), "|", 2)
			part := sequence[0]
			if !h.Done {
				part = "DONE"
				if len(sequence) == 2 {
					part = sequence[1]
				}
			}
			if fields := strings.Fields(part); len(fields) > 0 {
				next = strings.SplitN(fields[0], "(", 2)[0]
			}
		} else if h.State == "" {
			if len(states) > 0 {
				next = states[0]
			}
		} else {
			for i, state := range states {
				if state == h.State && i+1 < len(states) {
					next = states[i+1]
					break
				}
			}
		}
		at := start + h.Level
		for at < len(source) && (source[at] == ' ' || source[at] == '\t') {
			at++
		}
		to := at
		if h.State != "" {
			to += len(h.State)
			if to < len(source) && source[to] == ' ' {
				to++
			}
		}
		if next != "" {
			next += " "
		}
		out := splice(at, to, next)
		for _, updated := range Parse(out).Headings {
			if updated.Line == h.Line {
				if updated.Done && !h.Done {
					if h.Clock != "" {
						stopped, err := editClock(source, h, "clock-out")
						if err != nil {
							return "", err
						}
						return EditHeading(stopped, line, operation, value)
					}
					if repeated, ok, err := completeRepeater(source, h, next); ok {
						return repeated, err
					}
				}
				return setClosed(out, h.Line, updated.Done), nil
			}
		}
		return out, nil
	case "move-up", "move-down":
		if end > start && !strings.HasSuffix(source[start:end], "\n") {
			return "", errors.New("add a final newline before moving this subtree")
		}
		if operation == "move-up" {
			previous := -1
			for i := index - 1; i >= 0; i-- {
				if d.Headings[i].Level < h.Level {
					break
				}
				if d.Headings[i].Level == h.Level && d.Headings[i].Parent == h.Parent {
					previous = i
					break
				}
			}
			if previous < 0 {
				return "", errors.New("no previous sibling heading")
			}
			at := offsets[d.Headings[previous].Line-1]
			return source[:at] + source[start:end] + source[at:start] + source[end:], nil
		}
		if endIndex == len(d.Headings) || d.Headings[endIndex].Level != h.Level || d.Headings[endIndex].Parent != h.Parent {
			return "", errors.New("no next sibling heading")
		}
		nextEnd := len(source)
		for i := endIndex + 1; i < len(d.Headings); i++ {
			if d.Headings[i].Level <= h.Level {
				nextEnd = offsets[d.Headings[i].Line-1]
				break
			}
		}
		if !strings.HasSuffix(source[end:nextEnd], "\n") {
			return "", errors.New("add a final newline before moving this subtree")
		}
		return source[:start] + source[end:nextEnd] + source[start:end] + source[nextEnd:], nil
	case "schedule", "deadline":
		if !orgdate.ValidDate(value) {
			return "", errors.New("invalid date")
		}
		kind := "scheduled"
		if operation == "deadline" {
			kind = "deadline"
		}
		var matches []orgdate.Stamp
		for _, st := range h.Dates {
			if st.Kind == kind {
				matches = append(matches, st)
			}
		}
		if len(matches) > 1 {
			return "", errors.New("multiple planning timestamps; edit the source explicitly")
		}
		if len(matches) == 1 {
			return MoveTimestamp(source, matches[0].Start, matches[0].End, value)
		}
		bodyEnd := end
		if index+1 < len(d.Headings) {
			bodyEnd = offsets[d.Headings[index+1].Line-1]
		}
		if strings.Contains(source[start:bodyEnd], strings.ToUpper(kind)+":") {
			return "", errors.New("existing planning syntax is unsupported; edit the source explicitly")
		}
		at := offsets[h.Line]
		prefix := ""
		if !strings.HasSuffix(lines[h.Line-1], "\n") {
			prefix = eol
		}
		return splice(at, at, prefix+strings.ToUpper(kind)+": <"+value+">"+eol), nil
	}
	return "", errors.New("unknown heading command")
}

var stampDateRE = regexp.MustCompile(`^([<\[])\d{4}-\d{2}-\d{2}(?:\s+[A-Za-z]+)?`)

// MoveTimestamp validates that the indexed span still denotes one simple event.
func MoveTimestamp(source string, start, end int, date string) (string, error) {
	var timing *struct {
		Date    string `json:"date"`
		Time    string `json:"time"`
		EndTime string `json:"endTime"`
	}
	if strings.HasPrefix(date, "{") {
		if err := json.Unmarshal([]byte(date), &timing); err != nil || timing == nil {
			return "", errors.New("invalid calendar range")
		}
		date = timing.Date
		if timing.Time == "" && timing.EndTime != "" {
			return "", errors.New("end time requires start time")
		}
		for _, clock := range []string{timing.Time, timing.EndTime} {
			if clock != "" {
				if _, err := time.Parse("15:04", clock); err != nil {
					return "", errors.New("invalid calendar time")
				}
			}
		}
		if timing.EndTime != "" && timing.EndTime <= timing.Time {
			return "", errors.New("end time must follow start time")
		}
	}
	if !orgdate.ValidDate(date) || start < 0 || end > len(source) || start >= end {
		return "", errors.New("invalid timestamp edit")
	}
	var stamp *orgdate.Stamp
	d := Parse(source)
	for _, h := range d.Headings {
		for _, st := range h.Dates {
			if st.Start == start && st.End == end {
				copy := st
				stamp = &copy
			}
		}
	}
	if stamp == nil || !stamp.Active || stamp.Kind == "completed" || stamp.EndDate != "" || (timing == nil && stamp.Repeater != "") {
		return "", errors.New("only a single active timestamp can be moved")
	}
	day, _ := time.Parse("2006-01-02", date)
	replacement := stampDateRE.ReplaceAllString(stamp.Raw, "<"+date+" "+day.Format("Mon"))
	if timing != nil {
		prefix := regexp.MustCompile(`^<\d{4}-\d{2}-\d{2}(?:\s+[A-Za-z]+)?(?:\s+\d{2}:\d{2}(?:-\d{2}:\d{2})?)?`)
		header := "<" + date + " " + day.Format("Mon")
		if timing.Time != "" {
			header += " " + timing.Time
			if timing.EndTime != "" {
				header += "-" + timing.EndTime
			}
		}
		replacement = prefix.ReplaceAllString(stamp.Raw, header)
	}
	return source[:start] + replacement + source[end:], nil
}
