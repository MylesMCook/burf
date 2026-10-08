package box

import (
	"context"
)

// A task an agent hands off (TaskRequest.FromSession) makes a worktree that
// belongs under the worktree the agent works in: clients nest it there, so a
// chain of handoffs reads as a tree. The link lives in locations.json with
// the location, child path to parent path, like the titles. Only worktrees
// of the same location nest, and the main checkout is no parent: its
// worktrees are already the location's own. A parent that goes leaves its
// children at the top.

// parentFor is the path of the worktree session works in, when it is one of
// loc's worktrees other than its main checkout.
func (b *Box) parentFor(ctx context.Context, loc Location, session string) string {
	if session == "" {
		return ""
	}
	s, err := b.Sessions.Get(ctx, session)
	if err != nil {
		return ""
	}
	_, name := worktreeFor([]Location{loc}, s.Dir)
	for _, w := range loc.Worktrees {
		if w.Name == name && !w.Main {
			return w.Path
		}
	}
	return ""
}

// SetWorktreeParent puts the worktree at child under the one at parent.
func (l *Locations) SetWorktreeParent(location, child, parent string) error {
	if child == "" || parent == "" || child == parent {
		return nil
	}
	return l.update(func(all []savedLocation) ([]savedLocation, error) {
		for i := range all {
			if all[i].Name != location {
				continue
			}
			if all[i].Parents == nil {
				all[i].Parents = map[string]string{}
			}
			all[i].Parents[child] = parent
			return all, nil
		}
		return nil, ErrUnknownLocation
	})
}

// withParents sets each worktree's Parent from saved, skipping a parent
// that is no longer there and any link that would make a loop.
func withParents(wts []Worktree, saved map[string]string) {
	if len(saved) == 0 {
		return
	}
	live := map[string]bool{}
	for _, w := range wts {
		if !w.Main {
			live[w.Path] = true
		}
	}
	for i := range wts {
		p := saved[wts[i].Path]
		if !live[p] || loops(saved, wts[i].Path) {
			continue
		}
		wts[i].Parent = p
	}
}

// loops reports whether following parents from path comes back to it.
func loops(parents map[string]string, path string) bool {
	seen := map[string]bool{path: true}
	for p := parents[path]; p != ""; p = parents[p] {
		if seen[p] {
			return true
		}
		seen[p] = true
	}
	return false
}

// forgetParent drops a worktree that went from the tree: its own link, and
// its children's, so a worktree made again at its path adopts no one.
func (l *Locations) forgetParent(location, path string) {
	l.update(func(all []savedLocation) ([]savedLocation, error) {
		for i := range all {
			if all[i].Name != location || all[i].Parents == nil {
				continue
			}
			for c, p := range all[i].Parents {
				if c == path || p == path {
					delete(all[i].Parents, c)
				}
			}
			if len(all[i].Parents) == 0 {
				all[i].Parents = nil
			}
		}
		return all, nil
	})
}
