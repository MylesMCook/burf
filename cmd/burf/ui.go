package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/MylesMCook/burf/internal/statefile"
	"github.com/MylesMCook/burf/internal/uicontract"
)

const uiUsage = "usage: burf ui install PATH | status [--json] | rollback | remove"
const uiMaxBytes = 512 * 1024 * 1024

type uiManifest struct {
	Shell   string            `json:"shell"`
	Version string            `json:"version"`
	Files   map[string]string `json:"files"`
}

type uiStatus struct {
	Path       string `json:"path"`
	Installed  bool   `json:"installed"`
	Version    string `json:"version"`
	Shell      string `json:"shell"`
	Whole      bool   `json:"whole"`
	Compatible bool   `json:"compatible"`
	Reason     string `json:"reason,omitempty"`
}

func uiCommand(home string, args []string) error {
	if len(args) == 0 {
		return errors.New(uiUsage)
	}
	dir := filepath.Join(home, "ui")
	if args[0] == "status" && (len(args) == 1 || len(args) == 2 && args[1] == "--json") {
		out := inspectUI(filepath.Join(dir, "current"))
		if len(args) == 2 {
			return json.NewEncoder(os.Stdout).Encode(out)
		}
		if !out.Installed {
			fmt.Println("No interface folder installed. The desktop uses its built-in interface.")
		} else {
			fmt.Printf("%s\nVersion: %s\nShell: %s (this CLI: %s)\nWhole: %t; compatible: %t\n", out.Path, out.Version, out.Shell, uicontract.Shell(), out.Whole, out.Compatible)
			if out.Reason != "" {
				fmt.Println(out.Reason)
			}
		}
		return nil
	}
	if !(args[0] == "install" && len(args) == 2 || (args[0] == "rollback" || args[0] == "remove") && len(args) == 1) {
		return errors.New(uiUsage)
	}
	unlock, err := statefile.Lock(filepath.Join(dir, "install"))
	if err != nil {
		return err
	}
	defer unlock()
	switch args[0] {
	case "install":
		err = installUI(dir, args[1])
	case "rollback":
		err = rollbackUI(dir)
	case "remove":
		err = os.RemoveAll(filepath.Join(dir, "current"))
	}
	if err == nil {
		fmt.Println("Interface folder updated. Relaunch Burf to use it.")
	}
	return err
}

func validUIPath(name string) bool {
	if name == "" || strings.ContainsAny(name, "\\:") {
		return false
	}
	for _, part := range strings.Split(name, "/") {
		if part == "" || part == "." || part == ".." {
			return false
		}
	}
	return true
}

// Links and special files are refused. os.Root also prevents reads escaping
// through a parent link changed while copying or checking a source folder.
func uiFiles(dir string) (map[string][]byte, error) {
	info, err := os.Lstat(dir)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, errors.New("interface is not a directory")
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	files := make(map[string][]byte)
	var total int64
	err = fs.WalkDir(root.FS(), ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if name == "." {
			return nil
		}
		if !validUIPath(name) {
			return fmt.Errorf("invalid asset path: %s", name)
		}
		if entry.IsDir() {
			return nil
		}
		if !entry.Type().IsRegular() {
			return fmt.Errorf("asset is not a regular file: %s", name)
		}
		f, err := root.Open(name)
		if err != nil {
			return err
		}
		data, err := io.ReadAll(io.LimitReader(f, uiMaxBytes-total+1))
		closeErr := f.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		total += int64(len(data))
		if total > uiMaxBytes {
			return errors.New("interface exceeds 512 MiB")
		}
		files[name] = data
		return nil
	})
	return files, err
}

func checkUI(dir string) (uiManifest, error) {
	files, err := uiFiles(dir)
	var m uiManifest
	if err != nil {
		return m, err
	}
	if err = json.Unmarshal(files["manifest.json"], &m); err != nil {
		return m, fmt.Errorf("manifest.json: %w", err)
	}
	if m.Shell == "" || strings.TrimSpace(m.Version) == "" || m.Files["index.html"] == "" {
		return m, errors.New("manifest needs shell, version and index.html")
	}
	delete(files, "manifest.json")
	if len(files) != len(m.Files) {
		return m, errors.New("interface file list does not match manifest")
	}
	for name, hash := range m.Files {
		if !validUIPath(name) || name == "manifest.json" {
			return m, fmt.Errorf("invalid asset path: %s", name)
		}
		data, ok := files[name]
		sum := sha256.Sum256(data)
		if !ok || hex.EncodeToString(sum[:]) != hash {
			return m, fmt.Errorf("interface checksum does not match: %s", name)
		}
	}
	return m, nil
}

func inspectUI(dir string) uiStatus {
	s := uiStatus{Path: dir}
	if _, err := os.Lstat(dir); os.IsNotExist(err) {
		return s
	}
	s.Installed = true
	m, err := checkUI(dir)
	s.Version, s.Shell = m.Version, m.Shell
	s.Compatible = m.Shell == uicontract.Shell()
	s.Whole = err == nil
	if err != nil {
		s.Reason = err.Error()
	} else if !s.Compatible {
		s.Reason = "shell contract does not match this CLI; the desktop checks its own contract"
	}
	return s
}

func writeUIFile(dir, name string, data []byte) error {
	if !validUIPath(name) {
		return fmt.Errorf("invalid asset path: %s", name)
	}
	path := filepath.Join(dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	return err
}

func unzipUI(source, stage string) error {
	z, err := zip.OpenReader(source)
	if err != nil {
		return err
	}
	defer z.Close()
	var total uint64
	for _, f := range z.File {
		name := strings.TrimSuffix(f.Name, "/")
		if !validUIPath(name) {
			return fmt.Errorf("invalid zip path: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			continue
		}
		if !f.Mode().IsRegular() {
			return fmt.Errorf("zip asset is not a regular file: %s", name)
		}
		if f.UncompressedSize64 > uiMaxBytes || total > uiMaxBytes-f.UncompressedSize64 {
			return errors.New("interface exceeds 512 MiB")
		}
		total += f.UncompressedSize64
		r, err := f.Open()
		if err != nil {
			return err
		}
		data, err := io.ReadAll(io.LimitReader(r, int64(f.UncompressedSize64)+1))
		closeErr := r.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		if uint64(len(data)) != f.UncompressedSize64 {
			return errors.New("zip asset size does not match")
		}
		if err := writeUIFile(stage, name, data); err != nil {
			return err
		}
	}
	return nil
}

func installUI(dir, source string) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(dir, ".stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if info.IsDir() {
		files, err := uiFiles(source)
		if err != nil {
			return err
		}
		for name, data := range files {
			if err := writeUIFile(stage, name, data); err != nil {
				return err
			}
		}
	} else if err := unzipUI(source, stage); err != nil {
		return err
	}
	build := stage
	// Accept either zip layout: dist's contents, or one enclosing dist folder.
	if _, err := os.Stat(filepath.Join(build, "index.html")); os.IsNotExist(err) {
		entries, err := os.ReadDir(stage)
		if err != nil {
			return err
		}
		if len(entries) == 1 && entries[0].IsDir() {
			build = filepath.Join(stage, entries[0].Name())
		}
	}
	if _, err := os.Lstat(filepath.Join(build, "manifest.json")); os.IsNotExist(err) {
		files, err := uiFiles(build)
		if err != nil {
			return err
		}
		m := uiManifest{Shell: uicontract.Shell(), Version: "unversioned", Files: make(map[string]string)}
		for name, data := range files {
			sum := sha256.Sum256(data)
			m.Files[name] = hex.EncodeToString(sum[:])
		}
		data, err := json.MarshalIndent(m, "", "  ")
		if err != nil {
			return err
		}
		if err := writeUIFile(build, "manifest.json", append(data, '\n')); err != nil {
			return err
		}
	}
	m, err := checkUI(build)
	if err != nil {
		return err
	}
	if m.Shell != uicontract.Shell() {
		return errors.New("interface shell contract does not match this CLI")
	}
	return swapUI(dir, build)
}

// Directory rename never exposes a partial build. There is a brief absent
// current between renames: a concurrent launch safely selects the built-in UI.
// Failed renames restore the old current and previous before returning.
func swapUI(dir, stage string) error {
	current, previous := filepath.Join(dir, "current"), filepath.Join(dir, "previous")
	retired, err := os.MkdirTemp(dir, ".retired-")
	if err != nil {
		return err
	}
	defer func() {
		if retired != "" {
			_ = os.RemoveAll(retired)
		}
	}()
	backup := filepath.Join(retired, "previous")
	hadPrevious, hadCurrent := false, false
	if err := os.Rename(previous, backup); err == nil {
		hadPrevious = true
	} else if !os.IsNotExist(err) {
		return err
	}
	if err := os.Rename(current, previous); err == nil {
		hadCurrent = true
	} else if !os.IsNotExist(err) {
		if hadPrevious {
			if restoreErr := os.Rename(backup, previous); restoreErr != nil {
				backupPath := retired
				retired = ""
				return fmt.Errorf("install: %w; restore: %v; recovery: %s", err, restoreErr, backupPath)
			}
		}
		return err
	}
	if err := os.Rename(stage, current); err != nil {
		var restoreErr error
		if hadCurrent {
			restoreErr = os.Rename(previous, current)
		}
		if hadPrevious {
			restoreErr = errors.Join(restoreErr, os.Rename(backup, previous))
		}
		// Keep recovery files if the filesystem also refused restoration.
		if restoreErr != nil {
			backupPath := retired
			retired = ""
			return fmt.Errorf("install: %w; restore: %v; recovery: %s", err, restoreErr, backupPath)
		}
		return err
	}
	return nil
}

func rollbackUI(dir string) error {
	previous := filepath.Join(dir, "previous")
	m, err := checkUI(previous)
	if err != nil {
		return fmt.Errorf("previous interface: %w", err)
	}
	if m.Shell != uicontract.Shell() {
		return errors.New("previous interface shell contract does not match this CLI")
	}
	stage, err := os.MkdirTemp(dir, ".rollback-")
	if err != nil {
		return err
	}
	if err := os.Remove(stage); err != nil {
		return err
	}
	if err := os.Rename(previous, stage); err != nil {
		return err
	}
	if err := swapUI(dir, stage); err != nil {
		return errors.Join(err, os.Rename(stage, previous))
	}
	return nil
}
