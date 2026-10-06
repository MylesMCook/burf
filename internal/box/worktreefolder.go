package box

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// One folder of a worktree, for the app's Files panel: its files and
// folders, a level at a time.
//
//	GET /v1/locations/{name}/worktrees/{worktree}/files?dir=<folder>
//
// It asks git about that folder alone (git ls-files -- <folder>/): what git
// tracks there, and the untracked files it doesn't ignore. So it never
// depends on the 20,000-file list ⌘P searches (maxListedFiles), which in a
// bigger repository loses the folders late in the alphabet. Like the
// rest of the worktree's files, only paired peers reach it.

// maxWorktreeFolderEntries bounds one folder's answer; past it, Truncated says so.
const maxWorktreeFolderEntries = 5000

// WorktreeEntry is one child of a folder: a file, or a folder (Dir).
// Children says a folder has something in it to show; a submodule's folder
// has nothing git lists from here.
type WorktreeEntry struct {
	Name     string `json:"name"`
	Dir      bool   `json:"dir,omitempty"`
	Children bool   `json:"children,omitempty"`
}

// WorktreeFolder is what GET …/files?dir= answers: Dir as cleaned ("" is the
// worktree's top), its folders first, then its files, each in name order.
type WorktreeFolder struct {
	Dir       string          `json:"dir"`
	Entries   []WorktreeEntry `json:"entries"`
	Truncated bool            `json:"truncated,omitempty"`
}

type folderCacheEntry struct {
	at   time.Time
	list WorktreeFolder
}

// worktreeFolderCache keeps folder listings, by worktree folder and the
// folder in it, for filesFresh; a write that makes a file drops the
// worktree's (forgetWorktreeFiles).
var worktreeFolderCache sync.Map // root + "\x00" + dir → folderEntry

// forgetWorktreeFiles drops what is cached of a worktree's files, so a file
// just made shows at once.
func forgetWorktreeFiles(root string) {
	worktreeFilesCache.Delete(root)
	if real, err := filepath.EvalSymlinks(root); err == nil {
		root = real
	}
	worktreeFolderCache.Range(func(k, _ any) bool {
		if strings.HasPrefix(k.(string), root+"\x00") {
			worktreeFolderCache.Delete(k)
		}
		return true
	})
}

// worktreeFolder resolves the folder the app names: "" (or ".") is the
// top; otherwise the same rules as a file (relative, clean, no "..", never
// .git), still inside the worktree after symlinks, and a folder. It
// answers the real root and the folder relative to it, as git sees it.
func worktreeFolder(root, dir string) (realRoot, rel string, err error) {
	realRoot, err = filepath.EvalSymlinks(root)
	if err != nil {
		return "", "", httpError{http.StatusNotFound, "the worktree's folder is missing: " + root}
	}
	if d := strings.Trim(dir, "/"); d == "" || d == "." {
		if strings.HasPrefix(dir, "/") && len(dir) > 1 {
			return "", "", badRequest("give the folder relative to the worktree, not %s", dir)
		}
		return realRoot, "", nil
	}
	abs, _, err := worktreeFile(root, dir)
	if err != nil {
		return "", "", err
	}
	st, err := os.Stat(abs)
	if err != nil {
		return "", "", httpError{http.StatusNotFound, strings.Trim(dir, "/") + " isn't in this worktree"}
	}
	if !st.IsDir() {
		return "", "", badRequest("%s is a file, not a folder", strings.Trim(dir, "/"))
	}
	inner, ok := relInside(realRoot, abs)
	if !ok {
		return "", "", errPathOutside
	}
	return realRoot, filepath.ToSlash(inner), nil
}

// cachedFolder is listFolderGit for one folder, reused for filesFresh.
func cachedFolder(ctx context.Context, root, dir string) (WorktreeFolder, error) {
	key := root + "\x00" + dir
	if v, ok := worktreeFolderCache.Load(key); ok {
		if e := v.(folderCacheEntry); time.Since(e.at) < filesFresh {
			return e.list, nil
		}
	}
	list, err := listFolderGit(ctx, root, dir)
	if err != nil {
		return WorktreeFolder{}, err
	}
	worktreeFolderCache.Store(key, folderCacheEntry{at: time.Now(), list: list})
	return list, nil
}

// listFolderGit lists dir's children (dir relative to root, "" for the
// top): the files git tracks under it, and the untracked ones it doesn't
// ignore, cut to their first part below dir.
func listFolderGit(ctx context.Context, root, dir string) (WorktreeFolder, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	prefix := ""
	if dir != "" {
		prefix = dir + "/"
	}
	spec := []string{"--"}
	if dir != "" {
		// Literal: folder names like app/[id] are not patterns.
		spec = append(spec, ":(literal)"+prefix)
	}
	dirs := map[string]bool{}  // name
	files := map[string]bool{} // name
	whole := false             // the folder itself is untracked, every bit of it
	add := func(p string) {
		if !strings.HasPrefix(p, prefix) {
			return
		}
		rest := p[len(prefix):]
		if rest == "" {
			whole = true
			return
		}
		name, _, deeper := strings.Cut(rest, "/")
		if name == "" || strings.EqualFold(name, ".git") {
			return
		}
		if deeper {
			dirs[name] = true
			return
		}
		files[name] = true
	}
	// What git tracks, deleted files included (they are dropped below).
	if err := gitEach(ctx, root, append([]string{"ls-files", "-z", "--cached"}, spec...), add); err != nil {
		return WorktreeFolder{}, badRequest("git can't list the files here: %v", err)
	}
	// The untracked, a folder that is all untracked as one entry.
	if err := gitEach(ctx, root, append([]string{"ls-files", "-z", "--others", "--exclude-standard", "--directory", "--no-empty-directory"}, spec...), add); err != nil {
		return WorktreeFolder{}, badRequest("git can't list the files here: %v", err)
	}
	if whole {
		// Inside an untracked folder, --directory names the folder itself:
		// list what is in it instead.
		if err := gitEach(ctx, root, append([]string{"ls-files", "-z", "--others", "--exclude-standard"}, spec...), add); err != nil {
			return WorktreeFolder{}, badRequest("git can't list the files here: %v", err)
		}
	}
	base := filepath.Join(root, filepath.FromSlash(dir))
	out := WorktreeFolder{Dir: dir, Entries: []WorktreeEntry{}}
	for name := range dirs {
		// A folder git lists something in has children (an untracked one,
		// "new/", too: git leaves out the empty ones). One whose files are
		// all deleted is gone.
		if _, err := os.Lstat(filepath.Join(base, name)); err != nil {
			continue
		}
		out.Entries = append(out.Entries, WorktreeEntry{Name: name, Dir: true, Children: true})
	}
	for name := range files {
		st, err := os.Lstat(filepath.Join(base, name))
		if err != nil {
			// Deleted from the worktree, still in git's index.
			continue
		}
		if st.IsDir() {
			// A submodule: a folder git lists as one entry, with nothing
			// of it to list from here.
			out.Entries = append(out.Entries, WorktreeEntry{Name: name, Dir: true})
			continue
		}
		out.Entries = append(out.Entries, WorktreeEntry{Name: name})
	}
	sortFolder(out.Entries)
	if len(out.Entries) > maxWorktreeFolderEntries {
		out.Entries, out.Truncated = out.Entries[:maxWorktreeFolderEntries], true
	}
	return out, nil
}

// gitEach runs git in dir and calls each for every NUL-ended path it
// prints, as it prints them, so a big repository's top folder never sits
// in memory whole.
func gitEach(ctx context.Context, dir string, args []string, each func(string)) error {
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", dir}, args...)...)
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "GIT_OPTIONAL_LOCKS=0")
	var errb bytes.Buffer
	cmd.Stderr = &errb
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	r := bufio.NewReaderSize(pipe, 64<<10)
	for {
		p, err := r.ReadString(0)
		if len(p) > 1 {
			each(strings.TrimSuffix(p, "\x00"))
		}
		if err != nil {
			if !errors.Is(err, io.EOF) {
				cmd.Wait()
				return err
			}
			break
		}
	}
	if err := cmd.Wait(); err != nil {
		if msg := strings.TrimSpace(errb.String()); msg != "" {
			return &gitError{msg}
		}
		return err
	}
	return nil
}

// sortFolder puts folders first, then files, each by name as a person
// reads it: case aside, and numbers by their value (v2 before v10).
func sortFolder(es []WorktreeEntry) {
	sort.SliceStable(es, func(i, j int) bool {
		if es[i].Dir != es[j].Dir {
			return es[i].Dir
		}
		if c := naturalCompare(es[i].Name, es[j].Name); c != 0 {
			return c < 0
		}
		return es[i].Name < es[j].Name
	})
}

// naturalCompare compares a and b ignoring case, with runs of digits
// compared by value.
func naturalCompare(a, b string) int {
	a, b = strings.ToLower(a), strings.ToLower(b)
	for a != "" && b != "" {
		da, db := digitRun(a), digitRun(b)
		if da > 0 && db > 0 {
			na, nb := strings.TrimLeft(a[:da], "0"), strings.TrimLeft(b[:db], "0")
			if len(na) != len(nb) {
				return cmpInt(len(na), len(nb))
			}
			if na != nb {
				return strings.Compare(na, nb)
			}
			a, b = a[da:], b[db:]
			continue
		}
		if a[0] != b[0] {
			return cmpInt(int(a[0]), int(b[0]))
		}
		a, b = a[1:], b[1:]
	}
	return cmpInt(len(a), len(b))
}

func digitRun(s string) int {
	n := 0
	for n < len(s) && s[n] >= '0' && s[n] <= '9' {
		n++
	}
	return n
}

func cmpInt(a, b int) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}

func (b *Box) listWorktreeFolder(w http.ResponseWriter, r *http.Request, wt Worktree) error {
	root, dir, err := worktreeFolder(wt.Path, r.URL.Query().Get("dir"))
	if err != nil {
		return err
	}
	list, err := cachedFolder(r.Context(), root, dir)
	if err != nil {
		return err
	}
	writeJSON(w, list)
	return nil
}
