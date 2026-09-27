package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/mannders00/OrbitalNote/internal/syncclient"
	"github.com/mannders00/OrbitalNote/internal/workspace"
)

const hostedSyncURL = "https://sync.orbitalnote.org"

// Never send saved credentials from another service to the hosted endpoint.
func hostedSyncAPI(credentials syncCredentials) (*syncclient.API, error) {
	if strings.TrimRight(credentials.Server, "/") != hostedSyncURL {
		return nil, errors.New("this connection uses a different Sync service; save its recovery key and disconnect before signing in to OrbitalNote Sync")
	}
	return syncclient.NewAPI(hostedSyncURL, credentials.Token)
}

type syncCredentials struct {
	Server, Token, Recovery string
	Ready                   bool
}
type syncStatus struct {
	Server      string `json:"server"`
	SignedIn    bool   `json:"signedIn"`
	Connected   bool   `json:"connected"`
	Message     string `json:"message"`
	LastSuccess string `json:"lastSuccess"`
	Used        int64  `json:"used"`
	Quota       int64  `json:"quota"`
}
type syncLogin struct {
	Token string `json:"token"`
	Code  string `json:"code"`
	URL   string `json:"url"`
}
type syncManager struct {
	mu          sync.Mutex
	statusMu    sync.Mutex
	ws          *workspace.Service
	engine      *syncclient.Engine
	credentials syncCredentials
	pending     *syncclient.API
	status      syncStatus
	loadedKey   string
	ctx         context.Context
	cancel      context.CancelFunc
}

func newSyncManager(ws *workspace.Service) *syncManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &syncManager{ws: ws, ctx: ctx, cancel: cancel, status: syncStatus{Message: "Sync is not connected."}}
}
func (m *syncManager) message(text string) {
	m.statusMu.Lock()
	m.status.Message = text
	m.statusMu.Unlock()
}
func syncDirectory() (string, error) {
	p, err := preferencePath()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(filepath.Dir(p), "sync")
	return dir, os.MkdirAll(dir, 0700)
}
func (m *syncManager) store() error {
	dir, err := syncDirectory()
	if err != nil {
		return err
	}
	key := m.loadedKey
	if key == "" {
		return errors.New("open a workspace first")
	}
	if key != m.ws.Status().Key {
		return errors.New("workspace changed while configuring Sync; retry in the current folder")
	}
	b, err := json.Marshal(m.credentials)
	if err != nil {
		return err
	}
	if err = secureSyncSet(key, string(b)); err != nil {
		return err
	}
	// Only this non-secret marker is on disk; credentials stay in Keychain/Keystore.
	return os.WriteFile(filepath.Join(dir, key+".enabled"), []byte("1\n"), 0600)
}
func (m *syncManager) connectEngine() error {
	if m.credentials.Recovery == "" || !m.credentials.Ready {
		return nil
	}
	api, err := hostedSyncAPI(m.credentials)
	if err != nil {
		return err
	}
	keys, err := syncclient.ParseRecovery(m.credentials.Recovery)
	if err != nil {
		return err
	}
	dir, err := syncDirectory()
	if err != nil {
		return err
	}
	name := workspace.Revision([]byte(api.URL + "\n" + keys.Vault + "\n" + m.ws.Status().Key))
	e, err := syncclient.NewEngine(api, keys, m.ws, filepath.Join(dir, name+".json"))
	if err != nil {
		return err
	}
	m.engine = e
	m.statusMu.Lock()
	m.status.Connected = true
	m.statusMu.Unlock()
	return nil
}
func (m *syncManager) load() error {
	key := m.ws.Status().Key
	if key == m.loadedKey {
		return nil
	}
	m.engine = nil
	m.pending = nil
	m.credentials = syncCredentials{}
	m.statusMu.Lock()
	m.status = syncStatus{Message: "Sync is not connected."}
	m.statusMu.Unlock()
	if key == "" {
		m.loadedKey = key
		return nil
	}
	dir, err := syncDirectory()
	if err != nil {
		return err
	}
	if _, err = os.Stat(filepath.Join(dir, key+".enabled")); errors.Is(err, os.ErrNotExist) {
		m.loadedKey = key
		return nil
	} else if err != nil {
		return err
	}
	value, err := secureSyncGet(key)
	if err != nil {
		return err
	}
	if err = json.Unmarshal([]byte(value), &m.credentials); err != nil {
		return err
	}
	m.loadedKey = key
	m.statusMu.Lock()
	m.status.Server = m.credentials.Server
	m.status.SignedIn = m.credentials.Token != ""
	m.statusMu.Unlock()
	// A damaged sync checkpoint must not prevent exporting the recovery key.
	return m.connectEngine()
}
func (m *syncManager) run() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			if !syncForeground() {
				continue
			}
			m.mu.Lock()
			err := m.load()
			if err == nil && m.engine != nil {
				err = m.engine.Tick(m.ctx)
				if err == nil {
					m.statusMu.Lock()
					m.status.LastSuccess = time.Now().Format(time.RFC3339)
					m.status.Used = m.engine.Used
					m.status.Quota = m.engine.Quota
					m.status.Message = "Up to date"
					m.statusMu.Unlock()
				}
			}
			if err != nil {
				m.message(err.Error())
			}
			m.mu.Unlock()
		}
	}
}
func (h *Host) SyncStatus() syncStatus {
	h.sync.statusMu.Lock()
	defer h.sync.statusMu.Unlock()
	return h.sync.status
}
func (h *Host) SyncStart() (syncLogin, error) {
	m := h.sync
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.load(); err != nil {
		return syncLogin{}, err
	}
	if m.engine != nil {
		return syncLogin{}, errors.New("disconnect the current Sync workspace before changing accounts")
	}
	if m.ws.Status().Key == "" {
		return syncLogin{}, errors.New("open a notebook before signing in to Sync")
	}
	api, err := syncclient.NewAPI(hostedSyncURL, "")
	if err != nil {
		return syncLogin{}, err
	}
	var login syncLogin
	if err = api.Request(m.ctx, "POST", "/api/device/start", map[string]string{"label": "OrbitalNote on " + runtime.GOOS}, &login); err != nil {
		return login, err
	}
	api.Token = login.Token
	m.pending = api
	// Do not expose the device bearer credential through the frontend bridge.
	login.Token = ""
	return login, nil
}
func (h *Host) SyncFinish() error {
	m := h.sync
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.load(); err != nil {
		return err
	}
	if m.pending == nil {
		return errors.New("start sign-in first")
	}
	var result struct {
		Approved bool `json:"approved"`
	}
	if err := m.pending.Request(m.ctx, "POST", "/api/device/poll", map[string]string{"token": m.pending.Token}, &result); err != nil {
		return err
	}
	if !result.Approved {
		return errors.New("approve the device code on the website first")
	}
	m.credentials = syncCredentials{Server: m.pending.URL, Token: m.pending.Token}
	if err := m.store(); err != nil {
		return err
	}
	m.pending = nil
	m.statusMu.Lock()
	m.status.Server = m.credentials.Server
	m.status.SignedIn = true
	m.status.Message = "Signed in. Create an encrypted workspace or enter its recovery key."
	m.statusMu.Unlock()
	return nil
}
func (h *Host) SyncCreate() (string, error) {
	m := h.sync
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.load(); err != nil {
		return "", err
	}
	if m.credentials.Token == "" {
		return "", errors.New("sign in first")
	}
	if m.engine != nil {
		return "", errors.New("a Sync workspace is already connected")
	}
	api, err := hostedSyncAPI(m.credentials)
	if err != nil {
		return "", err
	}
	var existing syncclient.Vault
	if err = api.Request(m.ctx, "GET", "/api/vault", nil, &existing); err != nil {
		return "", err
	}
	// Save the recovery key securely BEFORE creating anything remote, so a
	// dropped response or app crash cannot orphan an inaccessible workspace.
	var keys *syncclient.Keys
	if m.credentials.Recovery != "" {
		keys, err = syncclient.ParseRecovery(m.credentials.Recovery)
	} else {
		keys, err = syncclient.NewKeys()
	}
	if err != nil {
		return "", err
	}
	if existing.ID != "" {
		if existing.ID != keys.Vault {
			return "", errors.New("this account already has a workspace; enter its recovery key")
		}
		if err = keys.Verify(existing.Check); err != nil {
			return "", err
		}
	} else {
		m.credentials.Recovery = keys.Recovery()
		if err = m.store(); err != nil {
			return "", err
		}
		v := syncclient.Vault{ID: keys.Vault, Check: keys.Check()}
		if err = api.Request(m.ctx, "POST", "/api/vault", v, &existing); err != nil {
			return "", err
		}
	}
	m.credentials.Ready = true
	if err = m.store(); err != nil {
		return "", err
	}
	if err = m.connectEngine(); err != nil {
		return "", err
	}
	m.message("Connected. Save the recovery key before adding another device.")
	return keys.Recovery(), nil
}
func (h *Host) SyncConnect(recovery string) error {
	m := h.sync
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.load(); err != nil {
		return err
	}
	if m.credentials.Token == "" {
		return errors.New("sign in first")
	}
	if m.engine != nil {
		return errors.New("disconnect before connecting another encrypted workspace")
	}
	keys, err := syncclient.ParseRecovery(recovery)
	if err != nil {
		return err
	}
	api, err := hostedSyncAPI(m.credentials)
	if err != nil {
		return err
	}
	var v syncclient.Vault
	if err = api.Request(m.ctx, "GET", "/api/vault", nil, &v); err != nil {
		return err
	}
	if v.ID != keys.Vault {
		return errors.New("recovery key is for a different account's workspace")
	}
	if err = keys.Verify(v.Check); err != nil {
		return err
	}
	m.credentials.Recovery = keys.Recovery()
	m.credentials.Ready = true
	if err = m.store(); err != nil {
		return err
	}
	if err = m.connectEngine(); err != nil {
		return err
	}
	m.message("Connected. Reconciling local and encrypted remote notes…")
	return nil
}
func (h *Host) SyncRecovery() (string, error) {
	m := h.sync
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.load(); err != nil {
		return "", err
	}
	if m.credentials.Recovery == "" {
		return "", errors.New("no encryption key on this device")
	}
	return m.credentials.Recovery, nil
}
func (h *Host) SyncDisconnect() error {
	m := h.sync
	m.mu.Lock()
	defer m.mu.Unlock()
	key := m.ws.Status().Key
	dir, err := syncDirectory()
	if err != nil {
		return err
	}
	m.engine = nil
	m.pending = nil
	m.statusMu.Lock()
	m.status.Connected = false
	m.statusMu.Unlock()
	if err = os.Remove(filepath.Join(dir, key+".enabled")); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err = secureSyncDelete(key); err != nil {
		return err
	}
	m.credentials = syncCredentials{}
	m.statusMu.Lock()
	m.status = syncStatus{Message: "Disconnected. Local files and recovery checkpoints were kept."}
	m.statusMu.Unlock()
	return nil
}
