package orgdoc

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

var headingTagsRE = regexp.MustCompile(`\s+:[\pL\pN_@#%:]+:\s*$`)
var tagNameRE = regexp.MustCompile(`^[\pL\pN_@#%]+$`)
var propertyNameRE = regexp.MustCompile(`^[A-Za-z0-9_@#%+-]+$`)
var priorityRE = regexp.MustCompile(`\[#[A-Za-z0-9]\]\s*`)

// File drawers may follow initial blank lines and comments, before keywords/body.
func filePropertyStart(source string) int {
	at := 0
	for _, line := range strings.SplitAfter(source, "\n") {
		text := strings.TrimSpace(line)
		if text != "" && text != "#" && !strings.HasPrefix(text, "# ") {
			break
		}
		at += len(line)
	}
	return at
}

// Metadata edits splice only the selected heading line or property entry.
func editMetadata(source string, h Heading, operation, value string) (string, error) {
	lines := strings.SplitAfter(source, "\n")
	start := 0
	for _, line := range lines[:h.Line-1] {
		start += len(line)
	}
	text := strings.TrimRight(lines[h.Line-1], "\r\n")
	eol := "\n"
	if strings.HasSuffix(lines[h.Line-1], "\r\n") {
		eol = "\r\n"
	}
	splice := func(a, b int, v string) string { return source[:a] + v + source[b:] }
	if operation == "tags" {
		var tags []string
		seen := map[string]bool{}
		for _, tag := range strings.Fields(strings.ReplaceAll(value, ":", " ")) {
			if !tagNameRE.MatchString(tag) {
				return "", errors.New("tags may contain letters, numbers, _, @, #, and %")
			}
			if !seen[tag] {
				tags = append(tags, tag)
				seen[tag] = true
			}
		}
		at := len(text)
		if match := headingTagsRE.FindStringIndex(text); match != nil {
			at = match[0]
		}
		replacement := ""
		if len(tags) > 0 {
			replacement = " :" + strings.Join(tags, ":") + ":"
		}
		return splice(start+at, start+len(text), replacement), nil
	}
	if operation == "priority" {
		if value != "" && !regexp.MustCompile(`^[A-Z0-9]$`).MatchString(value) {
			return "", errors.New("priority must be one uppercase letter or number")
		}
		at := h.Level
		for at < len(text) && (text[at] == ' ' || text[at] == '\t') {
			at++
		}
		if h.State != "" {
			at += len(h.State)
			for at < len(text) && (text[at] == ' ' || text[at] == '\t') {
				at++
			}
		}
		end := at
		if match := priorityRE.FindStringIndex(text[at:]); match != nil && match[0] == 0 {
			end += match[1]
		}
		if value != "" {
			value = "[#" + value + "] "
		}
		return splice(start+at, start+end, value), nil
	}
	var property struct {
		Name   string `json:"name"`
		Value  string `json:"value"`
		Remove bool   `json:"remove"`
	}
	if err := json.Unmarshal([]byte(value), &property); err != nil {
		return "", err
	}
	if !propertyNameRE.MatchString(property.Name) || strings.EqualFold(property.Name, "END") || strings.ContainsAny(property.Value, "\r\n") {
		return "", errors.New("use a property name and a single-line value")
	}
	property.Name = strings.ToUpper(property.Name)
	at := start + len(lines[h.Line-1])
	// A property drawer belongs immediately after the heading/planning lines.
	for i := h.Line; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if strings.HasPrefix(trimmed, "SCHEDULED:") || strings.HasPrefix(trimmed, "DEADLINE:") || strings.HasPrefix(trimmed, "CLOSED:") {
			at += len(lines[i])
			continue
		}
		if strings.EqualFold(trimmed, ":PROPERTIES:") {
			pos := at + len(lines[i])
			matchStart, matchEnd := -1, -1
			for j := i + 1; j < len(lines); j++ {
				line := strings.TrimSpace(lines[j])
				if strings.EqualFold(line, ":END:") {
					if matchStart >= 0 {
						replacement := ""
						if !property.Remove {
							replacement = ":" + property.Name + ": " + property.Value + eol
						}
						return splice(matchStart, matchEnd, replacement), nil
					}
					if property.Remove {
						return source, nil
					}
					return splice(pos, pos, ":"+property.Name+": "+property.Value+eol), nil
				}
				if strings.HasPrefix(line, "*") {
					break
				}
				if strings.HasPrefix(strings.ToUpper(line), ":"+property.Name+":") {
					if matchStart >= 0 {
						return "", errors.New("duplicate property; edit the source explicitly")
					}
					matchStart, matchEnd = pos, pos+len(lines[j])
				}
				pos += len(lines[j])
			}
			return "", errors.New("unclosed property drawer; edit the source explicitly")
		}
		break
	}
	if property.Remove {
		return source, nil
	}
	prefix := ""
	if at > 0 && source[at-1] != '\n' {
		prefix = eol
	}
	return splice(at, at, prefix+":PROPERTIES:"+eol+":"+property.Name+": "+property.Value+eol+":END:"+eol), nil
}
