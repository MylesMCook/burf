// Package uibundle verifies and snapshots the desktop interface independently
// of the native shell. A selected interface never reads its source again.
package uibundle

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"unicode/utf8"
)

const MaxBytes = 512 * 1024 * 1024
const BuiltinEnv = "BERTH_UI_BUILTIN"

type Manifest struct {
	Shell   string            `json:"shell"`
	Version string            `json:"version"`
	Files   map[string]string `json:"files"`
}

type InterfaceInfo struct {
	Source  string `json:"source"`
	Version string `json:"version"`
	Shell   string `json:"shell"`
	Reason  string `json:"reason"`
}

// ValidPath accepts only portable relative asset names. The manifest itself
// uses slash-separated paths on every platform.
func ValidPath(name string) bool {
	return fs.ValidPath(name) && name != "." && !strings.ContainsAny(name, "\\:")
}

// Verify returns the exact bytes whose file list and hashes matched the
// manifest. Shell compatibility belongs to the caller so CLI status can report
// a whole interface made for another shell. A parsed manifest survives errors.
func Verify(dir string) (fs.FS, Manifest, error) {
	assets, err := Snapshot(dir)
	var manifest Manifest
	if err != nil {
		return nil, manifest, err
	}
	data, err := fs.ReadFile(assets, "manifest.json")
	if err != nil {
		return nil, manifest, fmt.Errorf("manifest.json: %w", err)
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, manifest, fmt.Errorf("manifest.json: %w", err)
	}
	if manifest.Shell == "" || strings.TrimSpace(manifest.Version) == "" || manifest.Files["index.html"] == "" {
		return nil, manifest, errors.New("manifest needs shell, version and index.html")
	}
	files := assets.(*snapshot).files
	if len(files)-1 != len(manifest.Files) {
		return nil, manifest, errors.New("interface file list does not match manifest")
	}
	for name, hash := range manifest.Files {
		if !ValidPath(name) || name == "manifest.json" {
			return nil, manifest, fmt.Errorf("invalid asset path: %s", name)
		}
		data, ok := files[name]
		sum := sha256.Sum256(data)
		if !ok || hex.EncodeToString(sum[:]) != hash {
			return nil, manifest, fmt.Errorf("interface checksum does not match: %s", name)
		}
	}
	// The manifest describes executable assets; it is not itself served by the
	// desktop, matching the existing interface folder's asset boundary.
	delete(files, "manifest.json")
	return newSnapshot(files), manifest, nil
}

// Select uses a verified folder in full or snapshots the built-in interface in
// full. The expected shell and built-in version are explicit because old and
// new native shells can coexist during migration. Errors mean the built-in
// interface itself could not be read; a rejected folder is explained in info.
func Select(builtin fs.FS, dir string, forceBuiltin bool, expectedShell, builtinVersion string) (fs.FS, InterfaceInfo, error) {
	info := InterfaceInfo{Source: "built-in", Version: builtinVersion, Shell: expectedShell}
	if expectedShell == "" || strings.TrimSpace(builtinVersion) == "" {
		return nil, info, errors.New("built-in interface needs shell and version")
	}
	var assets fs.FS
	var manifest Manifest
	var err error
	if forceBuiltin {
		err = fmt.Errorf("%s is set", BuiltinEnv)
	} else {
		assets, manifest, err = Verify(dir)
		if err == nil && manifest.Shell != expectedShell {
			err = errors.New("interface shell contract does not match")
		}
		if err == nil {
			err = checkHTML(assets)
		}
	}
	if err == nil {
		info.Source, info.Version = "folder", manifest.Version
		info.Reason = "whole interface with matching shell contract"
		return assets, info, nil
	}
	info.Reason = err.Error()
	assets, err = snapshotFS(builtin)
	if err != nil {
		return nil, info, fmt.Errorf("built-in interface: %w", err)
	}
	if _, err := fs.Stat(assets, "index.html"); err != nil {
		return nil, info, fmt.Errorf("built-in index.html: %w", err)
	}
	if err := checkHTML(assets); err != nil {
		return nil, info, fmt.Errorf("built-in interface: %w", err)
	}
	return assets, info, nil
}

func checkHTML(assets fs.FS) error {
	for name, data := range assets.(*snapshot).files {
		if strings.HasSuffix(name, ".html") && !utf8.Valid(data) {
			return fmt.Errorf("invalid UTF-8 HTML: %s", name)
		}
	}
	return nil
}
