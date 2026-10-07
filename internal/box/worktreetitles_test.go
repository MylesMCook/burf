package box

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
)

func TestWorktreeTitleIsSetClearedAndKeptWithTheLocation(t *testing.T) {
	repo := gitRepo(t)
	ctx := context.Background()
	file := filepath.Join(t.TempDir(), "locations.json")
	l := NewLocations(file)
	if _, err := l.Add(ctx, "cal", repo); err != nil {
		t.Fatal(err)
	}
	wt, err := l.CreateWorktree(ctx, "cal", "https-linear-app-acme", "", "main")
	if err != nil {
		t.Fatal(err)
	}

	got, err := l.SetWorktreeTitle(ctx, "cal", wt.Name, "  Fix   checkout webhook\n")
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Fix checkout webhook" || got.Name != "https-linear-app-acme" || got.Branch != "https-linear-app-acme" {
		t.Fatalf("renamed = %+v", got)
	}

	// Another Locations on the same file (a restart) lists it with its title;
	// the branch and folder are what they were.
	again := NewLocations(file)
	loc, err := again.Get(ctx, "cal")
	if err != nil {
		t.Fatal(err)
	}
	i := slices.IndexFunc(loc.Worktrees, func(w Worktree) bool { return w.Path == wt.Path })
	if i < 0 || loc.Worktrees[i].Title != "Fix checkout webhook" || loc.Worktrees[i].Branch != wt.Branch {
		t.Fatalf("after restart: %+v", loc.Worktrees)
	}
	if _, err := os.Stat(wt.Path); err != nil {
		t.Fatalf("the folder moved: %v", err)
	}
	all, _ := again.List(ctx)
	if all[0].Worktrees[i].Title != "Fix checkout webhook" {
		t.Fatalf("List lost the title: %+v", all[0].Worktrees)
	}

	// The main checkout can be named too, and stays apart.
	if _, err := l.SetWorktreeTitle(ctx, "cal", "cal", "Trunk"); err != nil {
		t.Fatal(err)
	}

	// Clearing it, or naming it its own name, shows it by its name again.
	for _, clear := range []string{"", "https-linear-app-acme"} {
		l.SetWorktreeTitle(ctx, "cal", wt.Name, "Something")
		got, err = l.SetWorktreeTitle(ctx, "cal", wt.Name, clear)
		if err != nil || got.Title != "" {
			t.Fatalf("clear with %q: %+v %v", clear, got, err)
		}
	}
	b, _ := os.ReadFile(file)
	if strings.Contains(string(b), wt.Path) {
		t.Fatalf("a cleared title stayed in the file:\n%s", b)
	}
	if !strings.Contains(string(b), `"Trunk"`) {
		t.Fatalf("the main checkout's title went:\n%s", b)
	}

	// A long one is clipped.
	got, _ = l.SetWorktreeTitle(ctx, "cal", wt.Name, strings.Repeat("word ", 40))
	if n := len([]rune(got.Title)); n == 0 || n > WorktreeTitleMax {
		t.Fatalf("title of %d runes: %q", n, got.Title)
	}

	// Unknown worktrees and locations say so.
	if _, err := l.SetWorktreeTitle(ctx, "cal", "nope", "x"); err != ErrUnknownWorktree {
		t.Fatalf("unknown worktree: %v", err)
	}
	if _, err := l.SetWorktreeTitle(ctx, "nope", "x", "x"); err != ErrUnknownLocation {
		t.Fatalf("unknown location: %v", err)
	}
}

func TestARemovedWorktreeTakesItsTitleWithIt(t *testing.T) {
	repo := gitRepo(t)
	ctx := context.Background()
	l := NewLocations(filepath.Join(t.TempDir(), "locations.json"))
	l.Add(ctx, "cal", repo)
	wt, err := l.CreateWorktree(ctx, "cal", "billing", "", "main")
	if err != nil {
		t.Fatal(err)
	}
	l.SetWorktreeTitle(ctx, "cal", "billing", "Billing credits")
	if err := l.RemoveWorktree(ctx, "cal", "billing", true); err != nil {
		t.Fatal(err)
	}
	// Made again under the same name, it starts without one.
	wt2, err := l.CreateWorktree(ctx, "cal", "billing", "billing-2", "main")
	if err != nil {
		t.Fatal(err)
	}
	loc, _ := l.Get(ctx, "cal")
	for _, w := range loc.Worktrees {
		if w.Path == wt2.Path && w.Title != "" {
			t.Fatalf("%s came back with the old title %q (was %s)", w.Name, w.Title, wt.Path)
		}
	}
}

func TestRenameWorktreeOverTheWire(t *testing.T) {
	c, bus := servedBox(t)
	seen, stop := bus.Subscribe()
	defer stop()
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)
	var wt Worktree
	if status := call(t, c, "POST", "/v1/locations/cal/worktrees", "", WorktreeRequest{Name: "https-github-com-acme"}, &wt); status != 200 {
		t.Fatalf("add worktree: %d", status)
	}

	var got Worktree
	if status := call(t, c, "PATCH", "/v1/locations/cal/worktrees/https-github-com-acme", "", map[string]string{"title": "Retry failed payouts"}, &got); status != 200 || got.Title != "Retry failed payouts" || got.Name != wt.Name {
		t.Fatalf("rename: %d %+v", status, got)
	}
	// Every listing carries it.
	var locs []Location
	call(t, c, "GET", "/v1/locations", "", nil, &locs)
	if i := slices.IndexFunc(locs[0].Worktrees, func(w Worktree) bool { return w.Name == wt.Name }); i < 0 || locs[0].Worktrees[i].Title != "Retry failed payouts" {
		t.Fatalf("GET /v1/locations: %+v", locs)
	}
	var statuses []WorktreeStatus
	call(t, c, "GET", "/v1/worktrees", "", nil, &statuses)
	if i := slices.IndexFunc(statuses, func(s WorktreeStatus) bool { return s.Name == wt.Name }); i < 0 || statuses[i].Title != "Retry failed payouts" {
		t.Fatalf("GET /v1/worktrees: %+v", statuses)
	}

	var cleared Worktree
	// No title at all is a mistake; an empty one clears it.
	if status := call(t, c, "PATCH", "/v1/locations/cal/worktrees/https-github-com-acme", "", map[string]string{}, nil); status != 400 {
		t.Fatalf("no title: %d", status)
	}
	if status := call(t, c, "PATCH", "/v1/locations/cal/worktrees/https-github-com-acme", "", map[string]string{"title": ""}, &cleared); status != 200 || cleared.Title != "" || cleared.Name != wt.Name {
		t.Fatalf("clear: %d %+v", status, cleared)
	}
	if status := call(t, c, "PATCH", "/v1/locations/cal/worktrees/nope", "", map[string]string{"title": "x"}, nil); status != 404 {
		t.Fatalf("unknown worktree: %d", status)
	}

	// Other clients hear of it.
	deadline := time.After(3 * time.Second)
	for {
		select {
		case e := <-seen:
			if e.Type == "worktree.renamed" {
				if e.Data["name"] != wt.Name || e.Data["location"] != "cal" || e.Data["path"] != wt.Path {
					t.Fatalf("worktree.renamed = %+v", e.Data)
				}
				return
			}
		case <-deadline:
			t.Fatal("worktree.renamed never came")
		}
	}
}

func TestBoxSaysItNamesWorktrees(t *testing.T) {
	if !slices.Contains((&Box{Events: &events.Bus{}}).Capabilities(), "worktree.titles") {
		t.Fatal("worktree.titles missing from the capabilities")
	}
}

func TestThePhoneListsSessionsWithTheirWorktreesDisplayName(t *testing.T) {
	b, _, h := phoneBox(t)
	repo := gitRepo(t)
	ctx := context.Background()
	b.Locations.Add(ctx, "cal", repo)
	wt, err := b.Locations.CreateWorktree(ctx, "cal", "https-linear-app-acme", "", "main")
	if err != nil {
		t.Fatal(err)
	}
	b.Locations.SetWorktreeTitle(ctx, "cal", wt.Name, "Cart badge")
	if _, err := b.Sessions.Create(ctx, "named", "cal/"+wt.Name, wt.Path, "cat", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := b.Sessions.Create(ctx, "plain", "cal", repo, "cat", nil); err != nil {
		t.Fatal(err)
	}
	w := phoneReq(t, h, "GET", "/phone/v1/sessions", phoneAddr, "right-token", "")
	var got []struct {
		Name          string `json:"name"`
		WorktreeTitle string `json:"worktree_title"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("%v: %s", err, w.Body)
	}
	titles := map[string]string{}
	for _, s := range got {
		titles[s.Name] = s.WorktreeTitle
	}
	if titles["named"] != "Cart badge" || titles["plain"] != "" || len(got) != 2 {
		t.Fatalf("phone sessions = %s", w.Body)
	}
}
