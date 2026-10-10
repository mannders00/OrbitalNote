package workspace

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"
)

// DocumentStore keeps platform storage outside the parser/indexer and Sync.
// The transport is a synchronous, UTF-8 JSON JNI call on Android. File contents
// are base64, so neither JNI modified UTF-8 nor JSON can alter note bytes.
type DocumentStore struct {
	Tree   string
	Call   func([]byte) ([]byte, error)
	Active func() bool
}

func (d *DocumentStore) PollReady() bool { return d.Active == nil || d.Active() }

type documentRequest struct {
	Op       string `json:"op"`
	Tree     string `json:"tree"`
	Path     string `json:"path,omitempty"`
	To       string `json:"to,omitempty"`
	Data     []byte `json:"data,omitempty"`
	Revision string `json:"revision,omitempty"`
}
type documentResponse struct {
	Files    []File `json:"files"`
	Data     []byte `json:"data"`
	Revision string `json:"revision"`
	Error    string `json:"error"`
	Code     string `json:"code"`
}

func (d *DocumentStore) request(q documentRequest) (documentResponse, error) {
	var r documentResponse
	if q.Op != "list" && !valid(q.Path) || q.To != "" && !valid(q.To) {
		return r, errors.New("invalid workspace path")
	}
	q.Tree = d.Tree
	b, err := json.Marshal(q)
	if err != nil {
		return r, err
	}
	b, err = d.Call(b)
	if err != nil {
		return r, err
	}
	if err = json.Unmarshal(b, &r); err != nil {
		return r, fmt.Errorf("invalid Android storage response: %w", err)
	}
	if r.Error != "" {
		switch r.Code {
		case "missing":
			err = fs.ErrNotExist
		case "exists":
			err = fs.ErrExist
		case "conflict":
			err = ErrConflict
		default:
			err = errors.New("Android folder access failed")
		}
		return r, fmt.Errorf("%s: %w", r.Error, err)
	}
	return r, nil
}
func (d *DocumentStore) List() ([]File, error) {
	r, err := d.request(documentRequest{Op: "list"})
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, f := range r.Files {
		if !valid(f.Path) || seen[f.Path] || !f.Directory && !strings.EqualFold(path.Ext(f.Path), ".org") {
			return nil, errors.New("invalid or ambiguous Android folder listing")
		}
		seen[f.Path] = true
	}
	sort.Slice(r.Files, func(i, j int) bool { return r.Files[i].Path < r.Files[j].Path })
	if r.Files == nil {
		r.Files = []File{}
	}
	return r.Files, nil
}
func (d *DocumentStore) Read(p string) ([]byte, error) {
	r, err := d.request(documentRequest{Op: "read", Path: p})
	if err == nil && len(r.Data) > MaxFileSize {
		err = errors.New("file exceeds 8 MiB")
	}
	return r.Data, err
}
func (d *DocumentStore) Write(p string, b []byte, revision string) (string, error) {
	if !strings.EqualFold(path.Ext(p), ".org") || len(b) > MaxFileSize {
		return "", errors.New("notes must be .org files of at most 8 MiB")
	}
	r, err := d.request(documentRequest{Op: "write", Path: p, Data: b, Revision: revision})
	if err == nil && r.Revision != Revision(b) {
		err = errors.New("Android provider did not verify saved content")
	}
	return r.Revision, err
}
func (d *DocumentStore) Mkdir(p string) error {
	_, err := d.request(documentRequest{Op: "mkdir", Path: p})
	return err
}
func (d *DocumentStore) Rename(p, to string) error {
	_, err := d.request(documentRequest{Op: "rename", Path: p, To: to})
	return err
}
func (d *DocumentStore) Remove(p, revision string) error {
	_, err := d.request(documentRequest{Op: "remove", Path: p, Revision: revision})
	return err
}
