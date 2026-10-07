package box

import (
	"context"
	"net/http"
	"strings"

	"github.com/sean-brydon/berthd/internal/integrations/adapters"
)

// A worktree is named by its folder, which is often a slug made from a
// pasted link ("https-linear-app-calcom"). A person can give it a display
// name, its title, to show in its place in every client: the app on each
// laptop, the phone, the CLI's listings. It is a label only: the branch and
// the folder keep their names, so nothing on the box moves. The titles live
// in locations.json with the location, by worktree path, and go with the
// worktree when it is removed.

// WorktreeTitleMax is the longest a worktree's title can be.
const WorktreeTitleMax = 80

// SetWorktreeTitle names a worktree of a location; an empty title clears
// it, so it shows by its name again. It returns the worktree as it is now.
func (l *Locations) SetWorktreeTitle(ctx context.Context, location, name, title string) (Worktree, error) {
	loc, err := l.Get(ctx, location)
	if err != nil {
		return Worktree{}, err
	}
	var wt *Worktree
	for i := range loc.Worktrees {
		if loc.Worktrees[i].Name == name {
			wt = &loc.Worktrees[i]
		}
	}
	if wt == nil {
		return Worktree{}, ErrUnknownWorktree
	}
	title = adapters.Clip(title, WorktreeTitleMax)
	// A title that only repeats the name is no title.
	if title == wt.Name {
		title = ""
	}
	err = l.update(func(all []savedLocation) ([]savedLocation, error) {
		for i := range all {
			if all[i].Name != location {
				continue
			}
			if title == "" {
				delete(all[i].Titles, wt.Path)
			} else {
				if all[i].Titles == nil {
					all[i].Titles = map[string]string{}
				}
				all[i].Titles[wt.Path] = title
			}
			if len(all[i].Titles) == 0 {
				all[i].Titles = nil
			}
			return all, nil
		}
		return nil, ErrUnknownLocation
	})
	if err != nil {
		return Worktree{}, err
	}
	wt.Title = title
	return *wt, nil
}

// forgetTitle drops the title of a worktree that went.
func (l *Locations) forgetTitle(location, path string) {
	l.update(func(all []savedLocation) ([]savedLocation, error) {
		for i := range all {
			if all[i].Name == location && all[i].Titles != nil {
				delete(all[i].Titles, path)
				if len(all[i].Titles) == 0 {
					all[i].Titles = nil
				}
			}
		}
		return all, nil
	})
}

// renameWorktree is PATCH /v1/locations/{name}/worktrees/{worktree}:
// {"title": "..."} gives the worktree a display name; an empty one clears
// it. Its branch and folder are untouched.
func (b *Box) renameWorktree(w http.ResponseWriter, r *http.Request) error {
	location, name := r.PathValue("name"), r.PathValue("worktree")
	var req struct {
		Title *string `json:"title"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	if req.Title == nil {
		return badRequest("give a title (an empty one clears it)")
	}
	title := strings.TrimSpace(*req.Title)
	if err := b.before(r, "worktree.rename", map[string]any{"location": location, "name": name, "title": title}); err != nil {
		return err
	}
	wt, err := b.Locations.SetWorktreeTitle(r.Context(), location, name, title)
	if err != nil {
		return err
	}
	wt.Port, _ = b.Locations.Ports.For(wt.Path)
	b.publish(r, "worktree.renamed", map[string]any{"location": location, "name": name, "path": wt.Path})
	writeJSON(w, wt)
	return nil
}
