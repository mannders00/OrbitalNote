package orgdoc

import (
	"bytes"
	"strings"

	chromahtml "github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/lexers"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/niklasfasching/go-org/org"
	"golang.org/x/net/html"
)

type previewWriter struct{ *org.HTMLWriter }

// The default HTML exporter rewrites note.org to note.html. App navigation
// needs the workspace note path, not the name of a hypothetical HTML export.
func (w *previewWriter) WriteRegularLink(l org.RegularLink) {
	target := strings.TrimPrefix(l.URL, "file:")
	path := strings.SplitN(strings.SplitN(target, "::", 2)[0], "#", 2)[0]
	if (l.Protocol == "file" || l.Protocol == "") && strings.HasSuffix(strings.ToLower(path), ".org") {
		description := html.EscapeString(target)
		if l.Description != nil {
			description = w.WriteNodesAsString(l.Description...)
		}
		w.WriteString(`<a href="` + html.EscapeString(target) + `">` + description + `</a>`)
		return
	}
	w.HTMLWriter.WriteRegularLink(l)
}

func (w *previewWriter) WriteDrawer(d org.Drawer) {
	if d.Name == "LOGBOOK" {
		w.WriteString(`<div class="preview-logbook">`)
		org.WriteNodes(w, d.Children...)
		w.WriteString("</div>")
		return
	}
	w.HTMLWriter.WriteDrawer(d)
}

func (w *previewWriter) WritePropertyDrawer(d org.PropertyDrawer) {
	w.WriteString("<details><summary>Properties</summary><table>")
	for _, pair := range d.Properties {
		if len(pair) < 2 {
			continue
		}
		w.WriteString("<tr><th>" + html.EscapeString(pair[0]) + "</th><td>" + html.EscapeString(pair[1]) + "</td></tr>")
	}
	w.WriteString("</table></details>")
}
func (w *previewWriter) WriteHeadline(h org.Headline) {
	if h.Properties != nil {
		h.Children = append([]org.Node{*h.Properties}, h.Children...)
	}
	w.HTMLWriter.WriteHeadline(h)
}

func htmlWriter() org.Writer {
	w := org.NewHTMLWriter()
	w.HighlightCodeBlock = func(source, lang string, inline bool, params map[string]string) string {
		var out bytes.Buffer
		lexer := lexers.Get(lang)
		if lexer == nil {
			lexer = lexers.Fallback
		}
		tokens, err := lexer.Tokenise(nil, source)
		if err == nil {
			err = chromahtml.New(chromahtml.WithClasses(true)).Format(&out, styles.Fallback, tokens)
		}
		if err != nil {
			return "<pre>" + html.EscapeString(source) + "</pre>"
		}
		return out.String()
	}
	extended := &previewWriter{w}
	w.ExtendingWriter = extended
	return extended
}

// Images become inert placeholders before HTML reaches the WebView. Local
// bytes are loaded through the confined workspace service, never file:// URLs.
func imagePlaceholders(output string) string {
	root, err := html.Parse(strings.NewReader(output))
	if err != nil {
		return ""
	}
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "img" {
			src, alt := "", ""
			for _, a := range n.Attr {
				if a.Key == "src" {
					src = a.Val
				}
				if a.Key == "alt" {
					alt = a.Val
				}
			}
			n.Data = "span"
			n.DataAtom = 0
			n.Attr = []html.Attribute{{Key: "class", Val: "image-placeholder"}}
			if !strings.Contains(src, ":") || strings.HasPrefix(src, "file:") {
				n.Attr = append(n.Attr, html.Attribute{Key: "data-org-image", Val: src}, html.Attribute{Key: "data-alt", Val: alt})
			}
			n.AppendChild(&html.Node{Type: html.TextNode, Data: "Image: " + src})
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)
	var out bytes.Buffer
	_ = html.Render(&out, root)
	return out.String()
}
