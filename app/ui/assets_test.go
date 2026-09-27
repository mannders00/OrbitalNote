package ui

import (
	"io/fs"
	"path"
	"regexp"
	"strings"
	"testing"
)

// Native builds serve the embedded filesystem, not the source directory. A
// missing ES module prevents the entire interface from initializing even when
// compilation and JavaScript syntax checks succeed.
func TestEmbeddedModuleImports(t *testing.T) {
	imports := regexp.MustCompile(`(?m)^\s*import\s+[^;\n]*?\s+from\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)`)
	err := fs.WalkDir(Assets, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.HasSuffix(name, ".js") {
			return nil
		}
		source, err := Assets.ReadFile(name)
		if err != nil {
			return err
		}
		for _, match := range imports.FindAllStringSubmatch(string(source), -1) {
			target := match[1]
			if target == "" {
				target = match[2]
			}
			if strings.HasPrefix(target, "/wails/") {
				continue
			} // supplied by Wails
			if strings.HasPrefix(target, ".") {
				target = path.Join(path.Dir(name), target)
			} else if strings.HasPrefix(target, "/") {
				target = strings.TrimPrefix(target, "/")
			} else {
				continue
			}
			if _, err := Assets.ReadFile(target); err != nil {
				t.Errorf("%s imports %s, which is absent from the native asset bundle: %v", name, target, err)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
