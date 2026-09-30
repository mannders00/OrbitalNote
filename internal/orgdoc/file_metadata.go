package orgdoc

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

var fileKeywordRE = regexp.MustCompile(`(?i)^([ \t]*#\+)(TITLE|FILETAGS|AUTHOR|CATEGORY|DESCRIPTION):[ \t]*(.*)$`)

type fileKeyword struct {
	name, value string
	start, end  int
}

func fileKeywords(source string) []fileKeyword {
	var out []fileKeyword
	offset, block := 0, false
	for _, line := range strings.SplitAfter(source, "\n") {
		text := strings.TrimRight(line, "\r\n")
		lower := strings.ToLower(strings.TrimSpace(text))
		if strings.HasPrefix(lower, "#+begin_") {
			block = true
		}
		if !block {
			if headingRE.MatchString(text) {
				break
			}
			if match := fileKeywordRE.FindStringSubmatch(text); match != nil {
				out = append(out, fileKeyword{strings.ToUpper(match[2]), match[3], offset, offset + len(line)})
			}
		}
		if strings.HasPrefix(lower, "#+end_") {
			block = false
		}
		offset += len(line)
	}
	return out
}

func editFileMetadata(source, value string) (string, error) {
	var fields map[string]string
	if err := json.Unmarshal([]byte(value), &fields); err != nil {
		return "", err
	}
	for _, name := range []string{"TITLE", "FILETAGS", "CATEGORY", "AUTHOR", "DESCRIPTION"} {
		value, exists := fields[name]
		if !exists {
			continue
		}
		if strings.ContainsAny(value, "\r\n") {
			return "", errors.New("file metadata values must be single-line")
		}
		value = strings.TrimSpace(value)
		if name == "FILETAGS" && value != "" {
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
			if len(tags) > 0 {
				value = ":" + strings.Join(tags, ":") + ":"
			} else {
				value = ""
			}
		}
		var matches []fileKeyword
		for _, field := range fileKeywords(source) {
			if field.name == name {
				matches = append(matches, field)
			}
		}
		old := []string{}
		for _, field := range matches {
			old = append(old, field.value)
		}
		if strings.Join(old, " ") == value {
			continue
		}
		eol := "\n"
		if strings.Contains(source, "\r\n") {
			eol = "\r\n"
		}
		if len(matches) > 0 {
			for i := len(matches) - 1; i >= 0; i-- {
				field := matches[i]
				replacement := ""
				if i == 0 && value != "" {
					ending := ""
					raw := source[field.start:field.end]
					if strings.HasSuffix(raw, "\r\n") {
						ending = "\r\n"
					} else if strings.HasSuffix(raw, "\n") {
						ending = "\n"
					}
					replacement = "#+" + name + ": " + value + ending
				}
				source = source[:field.start] + replacement + source[field.end:]
			}
		} else if value != "" {
			at := filePropertyStart(source)
			// Keywords follow a file-level property drawer, never precede it.
			if strings.HasPrefix(strings.ToUpper(source[at:]), ":PROPERTIES:") {
				closed := false
				for _, line := range strings.SplitAfter(source[at:], "\n") {
					at += len(line)
					if strings.EqualFold(strings.TrimSpace(line), ":END:") {
						closed = true
						break
					}
				}
				if !closed {
					return "", errors.New("unclosed file property drawer")
				}
			}
			prefix := ""
			if at > 0 && source[at-1] != '\n' {
				prefix = eol
			}
			source = source[:at] + prefix + "#+" + name + ": " + value + eol + source[at:]
		}
	}
	return source, nil
}
