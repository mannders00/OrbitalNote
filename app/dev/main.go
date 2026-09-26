// A loopback-only development host for the same services and frontend as Wails.
// This is not the optional hosted sync service.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/mannders00/OrbitalNote/app/ui"
	"github.com/mannders00/OrbitalNote/internal/workspace"
)

type request struct {
	Method    string `json:"method"`
	ID        uint64 `json:"id"`
	Path      string `json:"path"`
	Source    string `json:"source"`
	Revision  string `json:"revision"`
	Query     string `json:"query"`
	To        string `json:"to"`
	Line      int    `json:"line"`
	Operation string `json:"operation"`
	Value     string `json:"value"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
}

func main() {
	folder := flag.String("workspace", "", "existing workspace directory")
	port := flag.Int("port", 9240, "loopback port")
	flag.Parse()
	s := workspace.NewService()
	defer s.Close()
	if *folder != "" {
		if _, err := s.Open(*folder); err != nil {
			log.Fatal(err)
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if r.Host != fmt.Sprintf("127.0.0.1:%d", *port) && r.Host != fmt.Sprintf("localhost:%d", *port) {
			http.Error(w, "invalid host", 403)
			return
		}
		if o := r.Header.Get("Origin"); o != "" && o != "http://"+r.Host {
			http.Error(w, "invalid origin", 403)
			return
		}
		if r.Method != "POST" || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "JSON POST required", 405)
			return
		}
		var q request
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, workspace.MaxFileSize+4096)).Decode(&q); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		var result any
		var err error
		switch q.Method {
		case "Status":
			result = s.Status()
		case "Open":
			result, err = s.Open(q.Path)
		case "Read":
			result, err = s.Read(q.ID, q.Path)
		case "Image":
			result, err = s.Image(q.ID, q.Path)
		case "Save":
			result, err = s.Save(q.ID, q.Path, q.Source, q.Revision)
		case "Preview":
			result, err = s.Preview(q.Source)
		case "Mkdir":
			err = s.Mkdir(q.ID, q.Path)
		case "Rename":
			err = s.Rename(q.ID, q.Path, q.To)
		case "Remove":
			err = s.Remove(q.ID, q.Path, q.Revision)
		case "Search":
			result, err = s.Search(q.ID, q.Query)
		case "Backlinks":
			result, err = s.Backlinks(q.ID, q.Path)
		case "Agenda":
			result, err = s.Agenda(q.ID)
		case "Calendar":
			result, err = s.Calendar(q.ID)
		case "Tags":
			result, err = s.Tags(q.ID)
		case "Edit":
			result, err = s.Edit(q.Source, q.Line, q.Operation, q.Value)
		case "Reschedule":
			result, err = s.Reschedule(q.ID, q.Path, q.Revision, q.Start, q.End, q.Value)
		default:
			err = fmt.Errorf("unknown method")
		}
		if err != nil {
			w.WriteHeader(409)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(result)
	})
	mux.Handle("/", http.FileServerFS(ui.Assets))
	server := &http.Server{Addr: fmt.Sprintf("127.0.0.1:%d", *port), Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("Local development workspace: http://%s", server.Addr)
	log.Fatal(server.ListenAndServe())
}
