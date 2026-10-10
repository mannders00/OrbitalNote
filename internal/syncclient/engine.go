package syncclient

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mannders00/OrbitalNote/internal/workspace"
)

// The local files plus this fsynced checkpoint form the durable work queue.
// A pending encrypted operation is persisted before sending it to the server.
type Record struct {
	Path, Hash string
	Remote     int64
}
type Pending struct {
	Request    Commit
	Path, Hash string
}
type checkpoint struct {
	Version int
	Binding string
	Records map[string]Record
	Pending *Pending
}
type Engine struct {
	API          *API
	Keys         *Keys
	Workspace    *workspace.Service
	WorkspaceKey string
	Journal      string
	Used, Quota  int64
	state        checkpoint
}

func NewEngine(api *API, keys *Keys, ws *workspace.Service, journal string) (*Engine, error) {
	key := ws.Status().Key
	if key == "" {
		return nil, errors.New("open a local workspace first")
	}
	binding := workspace.Revision([]byte(api.URL + "\n" + keys.Vault + "\n" + key))
	e := &Engine{API: api, Keys: keys, Workspace: ws, WorkspaceKey: key, Journal: journal, state: checkpoint{Version: 1, Binding: binding, Records: map[string]Record{}}}
	b, err := os.ReadFile(journal)
	if err == nil {
		if err = json.Unmarshal(b, &e.state); err != nil {
			return nil, fmt.Errorf("sync checkpoint damaged; retained for recovery: %w", err)
		}
		if e.state.Version != 1 || e.state.Binding != binding || e.state.Records == nil {
			return nil, errors.New("sync checkpoint belongs to another workspace or protocol")
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	return e, nil
}
func (e *Engine) save() error {
	if err := os.MkdirAll(filepath.Dir(e.Journal), 0700); err != nil {
		return err
	}
	b, err := json.Marshal(e.state)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(e.Journal), ".sync-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(b); err == nil {
		err = f.Sync()
	}
	ce := f.Close()
	if err != nil {
		return err
	}
	if ce != nil {
		return ce
	}
	if err = os.Rename(f.Name(), e.Journal); err != nil {
		return err
	}
	if d, err := os.Open(filepath.Dir(e.Journal)); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}
func (e *Engine) snapshot() (workspace.Snapshot, error) {
	s := e.Workspace.Status()
	if s.Key != e.WorkspaceKey {
		return s, errors.New("Sync is connected to a different local workspace")
	}
	if err := e.Workspace.Refresh(s.ID); err != nil {
		return s, err
	}
	s = e.Workspace.Status()
	if s.Key != e.WorkspaceKey {
		return s, errors.New("workspace changed during Sync reconciliation")
	}
	if len(s.Warnings) > 0 {
		return s, errors.New("workspace has unreadable files; sync paused to avoid propagating missing data")
	}
	return s, nil
}
func (e *Engine) read(id uint64, p string) ([]byte, string, error) {
	n, err := e.Workspace.Read(id, p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}
	return []byte(n.Source), n.Revision, nil
}
func (e *Engine) write(id uint64, p string, source []byte, expected string) error {
	if dir := path.Dir(p); dir != "." {
		parts := strings.Split(dir, "/")
		for i := range parts {
			if err := e.Workspace.Mkdir(id, strings.Join(parts[:i+1], "/")); err != nil && !errors.Is(err, os.ErrExist) {
				return err
			}
		}
	}
	_, err := e.Workspace.Save(id, p, string(source), expected)
	return err
}
func (e *Engine) sendPending(ctx context.Context) error {
	p := e.state.Pending
	if p == nil {
		return nil
	}
	var h Head
	if err := e.API.Request(ctx, "POST", "/api/commit", p.Request, &h); err != nil {
		var status *APIError
		if errors.As(err, &status) && status.Status == 409 {
			e.state.Pending = nil
			if saveErr := e.save(); saveErr != nil {
				return saveErr
			}
		}
		return err
	}
	if h.File != p.Request.File || h.Seq <= p.Request.Parent {
		return errors.New("invalid commit acknowledgment")
	}
	e.state.Records[h.File] = Record{Path: p.Path, Hash: p.Hash, Remote: h.Seq}
	e.state.Pending = nil
	return e.save()
}
func (e *Engine) Tick(ctx context.Context) error {
	s, err := e.snapshot()
	if err != nil {
		return err
	}
	var uploadBlocked error
	if err = e.sendPending(ctx); err != nil {
		var apiErr *APIError
		if errors.As(err, &apiErr) && (apiErr.Status == 402 || apiErr.Status == 413) {
			// Keep the outbox durable, but allow paid/quota-blocked clients to
			// retrieve their already-stored data and reconcile incoming changes.
			uploadBlocked = err
		} else {
			return err
		}
	}
	var remote Manifest
	if err = e.API.Request(ctx, "GET", "/api/manifest", nil, &remote); err != nil {
		return err
	}
	if remote.Vault != e.Keys.Vault {
		return errors.New("server returned a different workspace")
	}
	e.Used, e.Quota = remote.Used, remote.Quota
	heads := map[string]Head{}
	for _, h := range remote.Heads {
		if h.Seq <= 0 || h.File == "" {
			return errors.New("invalid manifest")
		}
		if _, ok := heads[h.File]; ok {
			return errors.New("duplicate manifest entry")
		}
		heads[h.File] = h
	}
	for id, base := range e.state.Records {
		if h, ok := heads[id]; !ok || h.Seq < base.Remote {
			return errors.New("server history moved backwards; sync paused for recovery")
		}
	}
	for _, h := range remote.Heads {
		base := e.state.Records[h.File]
		if base.Remote == h.Seq {
			continue
		}
		var cipher []byte
		if err = e.API.Request(ctx, "GET", fmt.Sprintf("/api/revisions/%d", h.Seq), nil, &cipher); err != nil {
			return err
		}
		d, err := e.Keys.Decrypt(h.File, cipher)
		if err != nil {
			return err
		}
		_, localHash, err := e.read(s.ID, d.Path)
		if err != nil {
			return err
		}
		remoteHash := ""
		if !d.Deleted {
			remoteHash = workspace.Revision(d.Source)
		}
		if localHash != remoteHash {
			if localHash != base.Hash {
				// Both changed. Preserve the remote version as an ordinary local
				// conflict note before allowing the local original to be uploaded.
				// An edit racing a remote deletion is kept and re-uploaded.
				if !d.Deleted {
					ext := path.Ext(d.Path)
					copyPath := strings.TrimSuffix(d.Path, ext) + fmt.Sprintf(" (sync conflict %d)", h.Seq) + ext
					if d.Path == workspace.SettingsFile {
						copyPath = fmt.Sprintf("OrbitalNote-settings (sync conflict %d).org", h.Seq)
					}
					_, copyHash, err := e.read(s.ID, copyPath)
					if err != nil {
						return err
					}
					if copyHash != "" && copyHash != remoteHash {
						return errors.New("conflict-copy path already contains different data; rename it before retrying")
					}
					if copyHash == "" {
						if err = e.write(s.ID, copyPath, d.Source, ""); err != nil {
							return err
						}
					}
				}
			} else if d.Deleted {
				if localHash != "" {
					if err = e.Workspace.Remove(s.ID, d.Path, localHash); err != nil {
						return err
					}
				}
			} else if err = e.write(s.ID, d.Path, d.Source, localHash); err != nil {
				return err
			}
		}
		e.state.Records[h.File] = Record{Path: d.Path, Hash: remoteHash, Remote: h.Seq}
		if err = e.save(); err != nil {
			return err
		}
	}
	// Re-scan after applying downloads and creating conflict notes. The workspace
	// service serializes writes with the editor and checks revisions on disk.
	if uploadBlocked != nil {
		return uploadBlocked
	}
	s, err = e.snapshot()
	if err != nil {
		return err
	}
	paths := map[string]bool{}
	for _, f := range s.Files {
		if !f.Directory {
			paths[f.Path] = true
		}
	}
	for _, r := range e.state.Records {
		paths[r.Path] = true
	}
	ordered := make([]string, 0, len(paths))
	for p := range paths {
		ordered = append(ordered, p)
	}
	sort.Strings(ordered)
	for _, p := range ordered {
		if !validPath(p) {
			return fmt.Errorf("unsupported sync path: %s", p)
		}
		data, hash, err := e.read(s.ID, p)
		if err != nil {
			return err
		}
		id := e.Keys.FileID(p)
		base := e.state.Records[id]
		if hash == base.Hash {
			continue
		}
		cipher, err := e.Keys.Encrypt(Document{Path: p, Source: data, Deleted: hash == ""})
		if err != nil {
			return err
		}
		op := make([]byte, 16)
		if _, err = rand.Read(op); err != nil {
			return err
		}
		e.state.Pending = &Pending{Request: Commit{Vault: e.Keys.Vault, File: id, Operation: hex.EncodeToString(op), Parent: base.Remote, Data: cipher}, Path: p, Hash: hash}
		if err = e.save(); err != nil {
			return err
		}
		if err = e.sendPending(ctx); err != nil {
			return err
		}
	}
	return nil
}
