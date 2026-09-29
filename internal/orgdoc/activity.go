package orgdoc

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

var runningClockRE = regexp.MustCompile(`(?m)^[ \t]*CLOCK: (\[\d{4}-\d{2}-\d{2} [A-Za-z]{3} \d{2}:\d{2}\])[ \t]*\r?$`)
var closedRE = regexp.MustCompile(`CLOSED:[ \t]*\[[^\]\r\n]+\][ \t]*`)

func ownBody(source string, line int) (int, int, string) {
	lines := strings.SplitAfter(source, "\n")
	at := 0
	for _, text := range lines[:line] {
		at += len(text)
	}
	end := len(source)
	for _, h := range Parse(source).Headings {
		if h.Line > line {
			end = 0
			for _, text := range lines[:h.Line-1] {
				end += len(text)
			}
			break
		}
	}
	eol := "\n"
	if strings.HasSuffix(lines[line-1], "\r\n") {
		eol = "\r\n"
	}
	return at, end, eol
}

func editClock(source string, h Heading, operation string) (string, error) {
	at, end, eol := ownBody(source, h.Line)
	body := source[at:end]
	matches := runningClockRE.FindAllStringSubmatchIndex(body, -1)
	now := time.Now()
	if operation == "clock-out" {
		if len(matches) != 1 {
			return "", errors.New("expected one running clock in this heading")
		}
		m := matches[0]
		started := body[m[2]+1 : m[3]-1]
		start, err := time.ParseInLocation("2006-01-02 Mon 15:04", started, time.Local)
		if err != nil {
			return "", err
		}
		minutes := int(now.Sub(start).Minutes())
		if minutes < 0 {
			return "", errors.New("clock start is in the future")
		}
		replacement := "CLOCK: [" + started + "]--[" + now.Format("2006-01-02 Mon 15:04") + fmt.Sprintf("] => %d:%02d", minutes/60, minutes%60)
		if strings.HasSuffix(body[m[0]:m[1]], "\r") {
			replacement += "\r"
		}
		return source[:at+m[0]] + replacement + source[at+m[1]:], nil
	}
	if len(matches) > 0 {
		return source, nil
	}
	entry := "CLOCK: [" + now.Format("2006-01-02 Mon 15:04") + "]" + eol
	drawer := regexp.MustCompile(`(?m)^:LOGBOOK:[ \t]*\r?\n`).FindStringIndex(body)
	if drawer != nil {
		p := at + drawer[1]
		return source[:p] + entry + source[p:], nil
	}
	prefix := ""
	if end > 0 && source[end-1] != '\n' {
		prefix = eol
	}
	return source[:end] + prefix + ":LOGBOOK:" + eol + entry + ":END:" + eol + source[end:], nil
}

func setClosed(source string, line int, done bool) string {
	at, _, eol := ownBody(source, line)
	// CLOSED belongs on planning lines, never in a code block or log drawer.
	end := at
	for end < len(source) {
		next := strings.IndexByte(source[end:], '\n')
		if next < 0 {
			next = len(source) - end
		} else {
			next++
		}
		text := strings.TrimSpace(source[end : end+next])
		if !strings.HasPrefix(text, "SCHEDULED:") && !strings.HasPrefix(text, "DEADLINE:") && !strings.HasPrefix(text, "CLOSED:") {
			break
		}
		end += next
	}
	planning := ""
	for _, raw := range strings.SplitAfter(source[at:end], "\n") {
		cleaned := closedRE.ReplaceAllString(raw, "")
		if cleaned != raw && strings.TrimSpace(cleaned) == "" {
			continue
		}
		planning += cleaned
	}
	if done {
		planning = "CLOSED: [" + time.Now().Format("2006-01-02 Mon 15:04") + "]" + eol + planning
	}
	// Drop only emptied planning lines.
	if strings.TrimSpace(planning) == "" {
		planning = ""
	}
	prefix := ""
	if at > 0 && source[at-1] != '\n' && planning != "" {
		prefix = eol
	}
	return source[:at] + prefix + planning + source[end:]
}

func toggleCheckbox(source string, line int) (string, error) {
	lines := strings.SplitAfter(source, "\n")
	if line < 1 || line > len(lines) {
		return "", errors.New("invalid checkbox line")
	}
	re := regexp.MustCompile(`^([ \t]*(?:[-+]|[0-9]+[.)])[ \t]+)\[([ Xx-])\]`)
	match := re.FindStringSubmatchIndex(lines[line-1])
	if match == nil {
		return "", errors.New("no checkbox on this line")
	}
	p := match[4]
	state := "X"
	if strings.EqualFold(lines[line-1][p:p+1], "X") {
		state = " "
	}
	lines[line-1] = lines[line-1][:p] + state + lines[line-1][p+1:]
	return strings.Join(lines, ""), nil
}
