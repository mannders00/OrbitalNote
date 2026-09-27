package syncclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type API struct {
	URL, Token string
	HTTP       *http.Client
}
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string { return e.Message }
func NewAPI(origin, token string) (*API, error) {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil || (u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost"))) {
		return nil, errors.New("use an HTTPS server origin, or HTTP localhost for development")
	}
	return &API{URL: origin, Token: token, HTTP: &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("sync server redirects are not allowed") }}}, nil
}
func (a *API) Request(ctx context.Context, method, path string, input, output any) error {
	var body io.Reader
	if input != nil {
		b, err := json.Marshal(input)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	r, err := http.NewRequestWithContext(ctx, method, a.URL+path, body)
	if err != nil {
		return err
	}
	if a.Token != "" {
		r.Header.Set("Authorization", "Bearer "+a.Token)
	}
	if input != nil {
		r.Header.Set("Content-Type", "application/json")
	}
	resp, err := a.HTTP.Do(r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, MaxCipher+1))
	if err != nil {
		return err
	}
	if len(data) > MaxCipher {
		return errors.New("server response too large")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var e struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(data, &e)
		if e.Error == "" {
			e.Error = fmt.Sprintf("Sync server returned HTTP %d", resp.StatusCode)
		}
		return &APIError{resp.StatusCode, e.Error}
	}
	if raw, ok := output.(*[]byte); ok {
		*raw = data
		return nil
	}
	if output == nil {
		return nil
	}
	return json.Unmarshal(data, output)
}

type Vault struct {
	ID    string `json:"id"`
	Check []byte `json:"check"`
}
type Head struct {
	File string `json:"file"`
	Seq  int64  `json:"seq"`
	Size int64  `json:"size"`
}
type Manifest struct {
	Vault string `json:"vault"`
	Heads []Head `json:"heads"`
	Used  int64  `json:"used"`
	Quota int64  `json:"quota"`
}
type Commit struct {
	Vault     string `json:"vault"`
	File      string `json:"file"`
	Operation string `json:"operation"`
	Parent    int64  `json:"parent"`
	Data      []byte `json:"data"`
}
