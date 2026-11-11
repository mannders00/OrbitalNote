package demo

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/mannders00/OrbitalNote/internal/workspace"
)

type Request struct {
	Method    string `json:"method"`
	ID        uint64 `json:"id"`
	Path      string `json:"path"`
	To        string `json:"to"`
	Source    string `json:"source"`
	Revision  string `json:"revision"`
	Query     string `json:"query"`
	Line      int    `json:"line"`
	Operation string `json:"operation"`
	Value     string `json:"value"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
}

func NewService(now time.Time) (*workspace.Service, error) {
	s := workspace.NewService()
	store := NewStore()
	for p, source := range Samples(now) {
		if _, err := store.Write(p, []byte(source), ""); err != nil {
			return nil, err
		}
	}
	_, err := workspace.OpenStore(s, "disposable-demo", "Demo workspace", store)
	return s, err
}

// Only workspace operations are exposed. Native host, Sync, filesystem selection,
// network, and account APIs are intentionally absent, not merely hidden in CSS.
func Dispatch(s *workspace.Service, q Request) (any, error) {
	switch q.Method {
	case "Status":
		return s.Status(), nil
	case "Read":
		return s.Read(q.ID, q.Path)
	case "Image":
		return s.Image(q.ID, q.Path)
	case "Save":
		return s.Save(q.ID, q.Path, q.Source, q.Revision)
	case "Preview":
		return s.Preview(q.Source)
	case "Mkdir":
		return nil, s.Mkdir(q.ID, q.Path)
	case "Rename":
		return nil, s.Rename(q.ID, q.Path, q.To)
	case "Remove":
		return nil, s.Remove(q.ID, q.Path, q.Revision)
	case "Search":
		return s.Search(q.ID, q.Query)
	case "Backlinks":
		return s.Backlinks(q.ID, q.Path)
	case "Agenda":
		return s.Agenda(q.ID)
	case "Calendar":
		return s.Calendar(q.ID)
	case "Tags":
		return s.Tags(q.ID)
	case "Edit":
		return s.Edit(q.Source, q.Line, q.Operation, q.Value)
	case "Reschedule":
		return s.Reschedule(q.ID, q.Path, q.Revision, q.Start, q.End, q.Value)
	default:
		return nil, fmt.Errorf("%s is unavailable in this disposable demo", q.Method)
	}
}

func JSON(s *workspace.Service, raw string) (out string) {
	defer func() {
		if recover() != nil {
			out = `{"error":"The demo could not process this request. Reset the demo to try again."}`
		}
	}()
	var q Request
	if len(raw) > MaxBytes+4096 {
		return `{"error":"Demo request is too large"}`
	}
	err := json.Unmarshal([]byte(raw), &q)
	var result any
	if err == nil {
		result, err = Dispatch(s, q)
	}
	if err != nil {
		result = map[string]string{"error": err.Error()}
	}
	b, err := json.Marshal(result)
	if err != nil {
		return `{"error":"Could not encode demo result"}`
	}
	return string(b)
}
