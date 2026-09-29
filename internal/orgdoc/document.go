// Package orgdoc retains source independently of the export-oriented Org AST.
package orgdoc

import (
	"fmt"
	"html"
	"regexp"
	"strings"

	"github.com/mannders00/OrbitalNote/internal/orgdate"
	"github.com/microcosm-cc/bluemonday"
	"github.com/niklasfasching/go-org/org"
)

type Heading struct {
	Line       int               `json:"line"`
	Level      int               `json:"level"`
	Parent     int               `json:"parent"`
	Title      string            `json:"title"`
	State      string            `json:"state"`
	Done       bool              `json:"done"`
	Tags       []string          `json:"tags"`
	Properties map[string]string `json:"properties"`
	Dates      []orgdate.Stamp   `json:"dates"`
	Clock      string            `json:"clock,omitempty"`
	History    []orgdate.Stamp   `json:"history,omitempty"`
}
type Link struct {
	Target string `json:"target"`
	Line   int    `json:"line"`
}
type Document struct {
	Properties map[string]string `json:"properties"`
	FileTags   []string          `json:"fileTags"`
	Source     string            `json:"source"`
	HTML       string            `json:"html"`
	Headings   []Heading         `json:"headings"`
	Links      []Link            `json:"links"`
	Warning    string            `json:"warning,omitempty"`
}

var headingRE = regexp.MustCompile(`^(\*+)\s+(.+)$`)
var propertyRE = regexp.MustCompile(`^:([^: ]+):\s*(.*)$`)
var linkRE = regexp.MustCompile(`\[\[([^\]]+)\](?:\[[^\]]*\])?\]`)

func config() *org.Configuration {
	c := org.New().Silent()
	c.ReadFile = func(string) ([]byte, error) { return nil, fmt.Errorf("includes are disabled") }
	c.DefaultSettings["OPTIONS"] = "toc:nil <:t e:t f:t pri:t todo:t tags:t title:nil"
	c.DefaultSettings["EXCLUDE_TAGS"] = ""
	return c
}

func Parse(source string) Document {
	d := Document{Source: source, Headings: []Heading{}, Links: []Link{}, Properties: map[string]string{}}
	fileLines := strings.Split(source[filePropertyStart(source):], "\n")
	if len(fileLines) > 0 && strings.EqualFold(strings.TrimSpace(fileLines[0]), ":PROPERTIES:") {
		for _, line := range fileLines[1:] {
			if strings.EqualFold(strings.TrimSpace(line), ":END:") {
				break
			}
			if headingRE.MatchString(line) {
				break
			}
			if p := propertyRE.FindStringSubmatch(strings.TrimSpace(line)); p != nil {
				d.Properties[strings.ToUpper(p[1])] = p[2]
			}
		}
	}
	c := config()
	ast := c.Parse(strings.NewReader(source), "")
	// Use the mature parser for heading semantics; use source scanning only for
	// coordinates and metadata absent from the AST. Never serialize AST to disk.
	var heads []*org.Headline
	var walk func(*org.Section)
	walk = func(s *org.Section) {
		for _, child := range s.Children {
			heads = append(heads, child.Headline)
			walk(child)
		}
	}
	walk(ast.Outline.Section)
	done := map[string]bool{"DONE": true}
	if todo := ast.Get("TODO"); strings.Contains(todo, "|") {
		done = map[string]bool{}
		for _, v := range strings.Fields(strings.SplitN(todo, "|", 2)[1]) {
			done[strings.SplitN(v, "(", 2)[0]] = true
		}
	}
	current := -1
	block := ""
	drawer := ""
	hi := 0
	offset := 0
	for line, raw := range strings.SplitAfter(source, "\n") {
		text := strings.TrimSuffix(strings.TrimSuffix(raw, "\n"), "\r")
		trim := strings.TrimSpace(text)
		upper := strings.ToUpper(trim)
		if block != "" {
			if upper == "#+END_"+block {
				block = ""
			}
			offset += len(raw)
			continue
		}
		if strings.HasPrefix(upper, "#+BEGIN_") {
			if fields := strings.Fields(strings.TrimPrefix(upper, "#+BEGIN_")); len(fields) > 0 {
				block = fields[0]
			}
			offset += len(raw)
			continue
		}
		if drawer != "" {
			if drawer == "LOGBOOK" && current >= 0 && strings.HasPrefix(trim, "- State ") {
				m := regexp.MustCompile(`^- State "([^"]+)"`).FindStringSubmatch(trim)
				if len(m) > 1 && done[m[1]] {
					for _, stamp := range orgdate.Parse(text) {
						stamp.Kind = "completed"
						d.Headings[current].History = append(d.Headings[current].History, stamp)
						break
					}
				}
			}
			if drawer == "LOGBOOK" && current >= 0 {
				if m := runningClockRE.FindStringSubmatch(text); m != nil {
					d.Headings[current].Clock = m[1]
				}
			}
			if upper == ":END:" {
				drawer = ""
			} else if drawer == "PROPERTIES" && current >= 0 {
				if m := propertyRE.FindStringSubmatch(trim); m != nil {
					d.Headings[current].Properties[m[1]] = m[2]
				}
			}
			offset += len(raw)
			continue
		}
		if strings.HasPrefix(trim, ":") && strings.HasSuffix(trim, ":") && !strings.ContainsAny(strings.Trim(trim, ":"), " \t") {
			drawer = strings.Trim(trim, ":")
			offset += len(raw)
			continue
		}
		if strings.HasPrefix(upper, "#+FILETAGS:") {
			for _, tag := range strings.FieldsFunc(trim[len("#+FILETAGS:"):], func(r rune) bool { return r == ':' || r == ' ' || r == '\t' }) {
				found := false
				for _, existing := range d.FileTags {
					if existing == tag {
						found = true
						break
					}
				}
				if !found {
					d.FileTags = append(d.FileTags, tag)
				}
			}
		}
		if m := headingRE.FindStringSubmatch(text); m != nil {
			h := Heading{Line: line + 1, Level: len(m[1]), Parent: -1, Title: m[2], Tags: []string{}, Properties: map[string]string{}, Dates: []orgdate.Stamp{}}
			if hi < len(heads) && heads[hi].Lvl == h.Level {
				a := heads[hi]
				h.Title = org.String(a.Title...)
				h.State = a.Status
				h.Done = done[a.Status]
				h.Tags = append(h.Tags, a.Tags...)
				hi++
			}
			for i := len(d.Headings) - 1; i >= 0; i-- {
				if d.Headings[i].Level < h.Level {
					h.Parent = i
					break
				}
			}
			d.Headings = append(d.Headings, h)
			current = len(d.Headings) - 1
		}
		if current >= 0 && !strings.HasPrefix(trim, "#") {
			for _, st := range orgdate.Parse(text) {
				st.Start += offset
				st.End += offset
				d.Headings[current].Dates = append(d.Headings[current].Dates, st)
			}
		}
		if !strings.HasPrefix(trim, "#") {
			for _, m := range linkRE.FindAllStringSubmatch(text, -1) {
				d.Links = append(d.Links, Link{m[1], line + 1})
			}
		}
		offset += len(raw)
	}
	if hi != len(heads) || len(d.Headings) != len(heads) {
		d.Warning = "Heading source positions could not be matched safely; structured edits and agenda metadata are unavailable for this document."
		d.Headings = []Heading{}
	}
	output, err := ast.Write(htmlWriter())
	if err != nil {
		d.Warning = err.Error()
		d.HTML = "<pre>" + html.EscapeString(source) + "</pre>"
		return d
	}
	p := bluemonday.UGCPolicy()
	p.AllowElements("details", "summary")
	p.AllowAttrs("class", "id").OnElements("span", "div", "pre", "code", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "li", "p")
	p.AllowStyles("text-decoration").Matching(regexp.MustCompile(`^underline$`)).OnElements("span")
	p.AllowAttrs("data-org-image", "data-alt").OnElements("span")
	output = imagePlaceholders(output)
	d.HTML = p.Sanitize(output)
	return d
}
