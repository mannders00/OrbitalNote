package workspace

import (
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
)

var ErrConflict = errors.New("file changed on disk; your edits have been retained")

const MaxFileSize = 8 << 20

type File struct {
	Path      string `json:"path"`
	Directory bool   `json:"directory"`
}
type Store interface {
	List() ([]File, error)
	Read(string) ([]byte, error)
	Write(string, []byte, string) (string, error)
	Mkdir(string) error
	Rename(string, string) error
	Remove(string, string) error
}
type Disk struct {
	root *os.Root
	mu   sync.Mutex
}

func OpenDisk(dir string) (*Disk, error) {
	r, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	return &Disk{root: r}, nil
}
func (d *Disk) Close() error   { return d.root.Close() }
func Revision(b []byte) string { return fmt.Sprintf("%x", sha256.Sum256(b)) }
func valid(p string) bool {
	return fs.ValidPath(p) && p != "." && !strings.Contains(p, "\\") && !strings.Contains(p, "\x00") && !strings.HasPrefix(path.Base(p), ".")
}
func (d *Disk) check(p string) error {
	if !valid(p) {
		return fmt.Errorf("invalid workspace path")
	}
	parts := strings.Split(p, "/")
	for i := range parts {
		info, err := d.root.Lstat(strings.Join(parts[:i+1], "/"))
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return errors.New("symbolic links are not supported")
		}
	}
	return nil
}
func (d *Disk) List() ([]File, error) {
	out := []File{}
	err := fs.WalkDir(d.root.FS(), ".", func(p string, e fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if p == "." {
			return nil
		}
		if strings.HasPrefix(e.Name(), ".") || e.Type()&os.ModeSymlink != 0 {
			if e.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if e.IsDir() || strings.EqualFold(path.Ext(p), ".org") {
			out = append(out, File{p, e.IsDir()})
		}
		return nil
	})
	return out, err
}
func (d *Disk) Read(p string) ([]byte, error) {
	if err := d.check(p); err != nil {
		return nil, err
	}
	info, err := d.root.Stat(p)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > MaxFileSize {
		return nil, errors.New("file must be regular and at most 8 MiB")
	}
	return d.root.ReadFile(p)
}
func (d *Disk) Write(p string, b []byte, expected string) (string, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if err := d.check(p); err != nil {
		return "", err
	}
	if !strings.EqualFold(path.Ext(p), ".org") {
		return "", errors.New("notes must use .org extension")
	}
	if len(b) > MaxFileSize {
		return "", errors.New("file exceeds 8 MiB")
	}
	old, err := d.Read(p)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return "", err
	}
	if (err == nil && Revision(old) != expected) || (errors.Is(err, fs.ErrNotExist) && expected != "") {
		return "", ErrConflict
	}
	mode := fs.FileMode(0644)
	if info, e := d.root.Stat(p); e == nil {
		mode = info.Mode().Perm()
	}
	tmp := path.Join(path.Dir(p), ".orbitalnote-"+rand.Text())
	f, err := d.root.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return "", err
	}
	defer d.root.Remove(tmp)
	if _, err = f.Write(b); err == nil {
		err = f.Chmod(mode)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return "", err
	}
	// Recheck immediately before replacement: external editors do not share our lock.
	latest, e := d.Read(p)
	if e != nil && !errors.Is(e, fs.ErrNotExist) {
		return "", e
	}
	if (e == nil && Revision(latest) != expected) || (errors.Is(e, fs.ErrNotExist) && expected != "") {
		return "", ErrConflict
	}
	if err = d.root.Rename(tmp, p); err != nil {
		return "", err
	}
	if dir, e := d.root.Open(filepath.ToSlash(path.Dir(p))); e == nil {
		_ = dir.Sync()
		_ = dir.Close()
	}
	return Revision(b), nil
}
func (d *Disk) Mkdir(p string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if err := d.check(p); err != nil {
		return err
	}
	return d.root.Mkdir(p, 0755)
}
func (d *Disk) Rename(from, to string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if err := d.check(from); err != nil {
		return err
	}
	if err := d.check(to); err != nil {
		return err
	}
	if _, err := d.root.Lstat(to); !errors.Is(err, fs.ErrNotExist) {
		return errors.New("destination already exists or cannot be accessed")
	}
	return d.root.Rename(from, to)
}
func (d *Disk) Remove(p, expected string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if err := d.check(p); err != nil {
		return err
	}
	if info, err := d.root.Stat(p); err != nil {
		return err
	} else if info.IsDir() {
		if expected != "" {
			return ErrConflict
		}
		return d.root.Remove(p)
	}
	b, err := d.Read(p)
	if err != nil {
		return err
	}
	if Revision(b) != expected {
		return ErrConflict
	}
	return d.root.Remove(p)
}
