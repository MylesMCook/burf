package box

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/cosscom/shipyard/internal/events"
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

func (s *ArtifactStore) takeSource(id, path, loc, wt, source string) {
	content, err := os.ReadFile(source)
	if err != nil {
		return
	}
	a, changed, err := s.Add(loc, wt, path, ArtifactInput{ID: id, Name: filepath.Base(source), Source: source, Content: content, Watch: true})
	if err != nil {
		if errors.Is(err, ErrUnknownArtifact) {
			return
		}
		s.mu.Lock()
		if c, ok := s.byID[id]; ok && c.Problem != err.Error() {
			c.Problem = err.Error()
			_ = s.save(c)
			cp := clone(c)
			s.mu.Unlock()
			s.publish("artifact.updated", cp, "watch")
			return
		}
		s.mu.Unlock()
		return
	}
	if changed {
		s.publish("artifact.updated", a, "watch")
	}
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
