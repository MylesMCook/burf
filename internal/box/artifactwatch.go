package box

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/MylesMCook/burf/internal/events"
)

// The watch: an artifact added from the box keeps its source file in
// view, and when the agent rewrites it the new content is a new version.
// Like the transcript watch it is a stat of each file, not a file-system
// watch: a few files, every half second. A change is taken once the file
// has held still for a moment, so a write in several pieces is one
// version; a rewrite that doesn't check (half-written JSON, too big, a
// secret) is noted on the artifact as its problem and the last good
// version stays.

const (
	artifactPoll   = 500 * time.Millisecond
	artifactSettle = 400 * time.Millisecond
)

type sourceStat struct {
	mod  time.Time
	size int64
	// seen is when this stat was first seen; a change is taken once it
	// has held for artifactSettle.
	seen  time.Time
	taken bool
}

// noteSource records path's current state as taken (it was just read).
// The caller holds s.mu.
func (s *ArtifactStore) noteSource(path string) {
	if s.watch == nil {
		s.watch = map[string]sourceStat{}
	}
	fi, err := os.Stat(path)
	if err != nil {
		s.watch[path] = sourceStat{taken: true}
		return
	}
	s.watch[path] = sourceStat{mod: fi.ModTime(), size: fi.Size(), seen: s.now(), taken: true}
}

// Run watches sources until ctx ends, and forgets a worktree's artifacts
// when the worktree is removed.
func (s *ArtifactStore) Run(ctx context.Context) {
	var evs <-chan events.Event
	if s.Events != nil {
		ch, unsub := s.Events.SubscribeNamed("artifacts")
		defer unsub()
		evs = ch
	}
	s.mu.Lock()
	s.load()
	for _, a := range s.byID {
		if a.Watched {
			s.noteSource(a.Source)
		}
	}
	s.mu.Unlock()
	t := time.NewTicker(artifactPoll)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case e, ok := <-evs:
			if !ok {
				evs = nil
				continue
			}
			if e.Type == "worktree.removed" {
				if p, _ := e.Data["path"].(string); p != "" {
					for _, a := range s.RemoveWorktree(p) {
						s.publish("artifact.removed", a, "")
					}
				}
			}
		case <-t.C:
			s.Poll()
		}
	}
}

// Poll looks at every watched source once and takes the ones that
// changed and held still.
func (s *ArtifactStore) Poll() {
	type due struct {
		id, path, loc, wt, source string
	}
	var take []due
	s.mu.Lock()
	s.load()
	if s.watch == nil {
		s.watch = map[string]sourceStat{}
	}
	now := s.now()
	for _, a := range s.byID {
		if !a.Watched || a.Source == "" {
			continue
		}
		fi, err := os.Stat(a.Source)
		if err != nil {
			continue // gone for now; it may come back
		}
		last, ok := s.watch[a.Source]
		cur := sourceStat{mod: fi.ModTime(), size: fi.Size()}
		switch {
		case !ok:
			// Not seen since berthd started: take it as it is now.
			cur.seen, cur.taken = now, true
			s.watch[a.Source] = cur
		case !last.mod.Equal(cur.mod) || last.size != cur.size:
			cur.seen = now
			s.watch[a.Source] = cur
		case !last.taken && now.Sub(last.seen) >= artifactSettle:
			last.taken = true
			s.watch[a.Source] = last
			take = append(take, due{a.ID, a.Path, a.Location, a.Worktree, a.Source})
		}
	}
	s.mu.Unlock()
	for _, d := range take {
		s.takeSource(d.id, d.path, d.loc, d.wt, d.source)
	}
}

// readSource reads a watched source for its worktree. A source inside the
// worktree is opened beneath it (os.Root), every folder on the way checked
// as it is walked: a link that leads out of the worktree, put in the file's
// place or a folder's at any moment, is not followed. A source registered
// from outside the worktree is read only as the file itself, never a link.
// Neither waits on a pipe.
func readSource(worktree, source string) ([]byte, error) {
	bases := []string{worktree}
	if real, err := filepath.EvalSymlinks(worktree); err == nil && real != worktree {
		bases = append(bases, real)
	}
	for _, base := range bases {
		rel, err := filepath.Rel(base, source)
		if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
			continue
		}
		root, err := os.OpenRoot(base)
		if err != nil {
			return nil, err
		}
		defer root.Close()
		f, err := root.OpenFile(rel, os.O_RDONLY|syscall.O_NONBLOCK, 0)
		if err != nil {
			return nil, err
		}
		return readOrdinary(f)
	}
	f, err := os.OpenFile(source, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
	if err != nil {
		return nil, err
	}
	return readOrdinary(f)
}

// readOrdinary reads an open file if it is an ordinary one, up to twice the
// largest artifact: the store says which limit a larger one broke.
func readOrdinary(f *os.File) ([]byte, error) {
	defer f.Close()
	if fi, err := f.Stat(); err != nil || !fi.Mode().IsRegular() {
		return nil, errors.New("the source is no longer a file")
	}
	return io.ReadAll(io.LimitReader(f, 2*maxPageArtifact))
}

func (s *ArtifactStore) takeSource(id, path, loc, wt, source string) {
	content, err := readSource(path, source)
	if err != nil {
		// Gone for now is nothing to say. Something there that is not
		// read is: the artifact would otherwise go stale in silence.
		if !errors.Is(err, fs.ErrNotExist) {
			s.problem(id, "its file is no longer an ordinary file reached without leaving the worktree (a link that leads out, or is absolute, is not followed)")
		}
		return
	}
	a, changed, err := s.Add(loc, wt, path, ArtifactInput{ID: id, Name: filepath.Base(source), Source: source, Content: content, Watch: true})
	if err != nil {
		if !errors.Is(err, ErrUnknownArtifact) {
			s.problem(id, err.Error())
		}
		return
	}
	if changed {
		s.publish("artifact.updated", a, "watch")
	}
}

// problem records why an artifact's latest rewrite wasn't taken, once.
func (s *ArtifactStore) problem(id, why string) {
	s.mu.Lock()
	c, ok := s.byID[id]
	if !ok || c.Problem == why {
		s.mu.Unlock()
		return
	}
	c.Problem = why
	_ = s.save(c)
	cp := clone(c)
	s.mu.Unlock()
	s.publish("artifact.updated", cp, "watch")
}

// publish announces a change to the app (and hooks).
func (s *ArtifactStore) publish(typ string, a Artifact, origin string) {
	if s.Events == nil {
		return
	}
	s.Events.Publish(events.Event{Type: typ, Box: s.Box, Origin: origin, Data: artifactEventData(a)})
}

func artifactEventData(a Artifact) map[string]any {
	d := map[string]any{"id": a.ID, "title": a.Title, "kind": a.Kind, "location": a.Location, "name": a.Worktree, "path": a.Path, "version": a.Latest().N}
	if a.By.Session != "" {
		d["session"] = a.By.Session
	}
	if a.Problem != "" {
		d["problem"] = a.Problem
	}
	return d
}
