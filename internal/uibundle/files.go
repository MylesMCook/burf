package uibundle

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"sort"
	"time"
)

// Snapshot copies a regular directory tree with no links or special files.
// os.Root confines reads even if a parent is replaced while the copy runs.
func Snapshot(dir string) (fs.FS, error) {
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
	return snapshotFS(root.FS())
}

func snapshotFS(source fs.FS) (fs.FS, error) {
	if source == nil {
		return nil, errors.New("interface filesystem is missing")
	}
	files := make(map[string][]byte)
	var total int64
	err := fs.WalkDir(source, ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if name == "." {
			return nil
		}
		if !ValidPath(name) {
			return fmt.Errorf("invalid asset path: %s", name)
		}
		if entry.IsDir() {
			return nil
		}
		if !entry.Type().IsRegular() {
			return fmt.Errorf("asset is not a regular file: %s", name)
		}
		file, err := source.Open(name)
		if err != nil {
			return err
		}
		info, err := file.Stat()
		if err != nil || !info.Mode().IsRegular() {
			_ = file.Close()
			if err != nil {
				return err
			}
			return fmt.Errorf("asset is not a regular file: %s", name)
		}
		if info.Size() > MaxBytes-total {
			_ = file.Close()
			return errors.New("interface exceeds 512 MiB")
		}
		data, err := io.ReadAll(io.LimitReader(file, MaxBytes-total+1))
		closeErr := file.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		total += int64(len(data))
		if total > MaxBytes {
			return errors.New("interface exceeds 512 MiB")
		}
		files[name] = data
		return nil
	})
	if err != nil {
		return nil, err
	}
	return newSnapshot(files), nil
}

func newSnapshot(files map[string][]byte) *snapshot {
	result := &snapshot{files: files, dirs: map[string][]fs.DirEntry{".": nil}}
	for name, data := range files {
		result.add(name, int64(len(data)), false)
	}
	for dir := range result.dirs {
		sort.Slice(result.dirs[dir], func(i, j int) bool { return result.dirs[dir][i].Name() < result.dirs[dir][j].Name() })
	}
	return result
}

// The private filesystem exposes readers, never its map or byte slices.
type snapshot struct {
	files map[string][]byte
	dirs  map[string][]fs.DirEntry
}

func (s *snapshot) add(name string, size int64, dir bool) {
	parent := path.Dir(name)
	if _, ok := s.dirs[parent]; !ok {
		s.dirs[parent] = nil
		s.add(parent, 0, true)
	}
	s.dirs[parent] = append(s.dirs[parent], assetInfo{name: path.Base(name), size: size, dir: dir})
}

func (s *snapshot) Open(name string) (fs.File, error) {
	if name != "." && !ValidPath(name) {
		return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrInvalid}
	}
	if data, ok := s.files[name]; ok {
		return &assetFile{reader: bytes.NewReader(data), info: assetInfo{name: path.Base(name), size: int64(len(data))}}, nil
	}
	if entries, ok := s.dirs[name]; ok {
		return &assetFile{info: assetInfo{name: path.Base(name), dir: true}, entries: entries}, nil
	}
	return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrNotExist}
}

type assetInfo struct {
	name string
	size int64
	dir  bool
}

func (i assetInfo) Name() string       { return i.name }
func (i assetInfo) Size() int64        { return i.size }
func (i assetInfo) ModTime() time.Time { return time.Time{} }
func (i assetInfo) IsDir() bool        { return i.dir }
func (i assetInfo) Sys() any           { return nil }
func (i assetInfo) Mode() fs.FileMode {
	if i.dir {
		return fs.ModeDir | 0o555
	}
	return 0o444
}
func (i assetInfo) Type() fs.FileMode          { return i.Mode().Type() }
func (i assetInfo) Info() (fs.FileInfo, error) { return i, nil }

type assetFile struct {
	reader  *bytes.Reader
	info    assetInfo
	entries []fs.DirEntry
	offset  int
	closed  bool
}

func (f *assetFile) Stat() (fs.FileInfo, error) { return f.info, nil }
func (f *assetFile) Close() error               { f.closed = true; return nil }
func (f *assetFile) Read(data []byte) (int, error) {
	if f.closed {
		return 0, fs.ErrClosed
	}
	if f.info.dir {
		return 0, errors.New("cannot read an interface directory")
	}
	return f.reader.Read(data)
}

func (f *assetFile) Seek(offset int64, whence int) (int64, error) {
	if f.closed {
		return 0, fs.ErrClosed
	}
	if f.info.dir {
		return 0, errors.New("cannot seek an interface directory")
	}
	return f.reader.Seek(offset, whence)
}
func (f *assetFile) ReadDir(n int) ([]fs.DirEntry, error) {
	if f.closed {
		return nil, fs.ErrClosed
	}
	if !f.info.dir {
		return nil, errors.New("interface asset is not a directory")
	}
	if n > 0 && f.offset == len(f.entries) {
		return nil, io.EOF
	}
	end := len(f.entries)
	if n > 0 && n < end-f.offset {
		end = f.offset + n
	}
	entries := append([]fs.DirEntry(nil), f.entries[f.offset:end]...)
	f.offset = end
	return entries, nil
}
