package box

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/MylesMCook/burf/internal/wire"
)

func TestWorktreeParentIsListedAndForgottenWithTheWorktree(t *testing.T) {
	repo := gitRepo(t)
	ctx := context.Background()
	file := filepath.Join(t.TempDir(), "locations.json")
	l := NewLocations(file)
	if _, err := l.Add(ctx, "cal", repo); err != nil {
		t.Fatal(err)
	}
	a, err := l.CreateWorktree(ctx, "cal", "listing", "", "main")
	if err != nil {
		t.Fatal(err)
	}
	b, err := l.CreateWorktree(ctx, "cal", "listing-service", "", "main")
	if err != nil {
		t.Fatal(err)
	}
	c, err := l.CreateWorktree(ctx, "cal", "listing-ui", "", "main")
	if err != nil {
		t.Fatal(err)
	}
	if err := l.SetWorktreeParent("cal", b.Path, a.Path); err != nil {
		t.Fatal(err)
	}
	if err := l.SetWorktreeParent("cal", c.Path, b.Path); err != nil {
		t.Fatal(err)
	}

	// Another Locations on the same file (a restart) lists the chain.
	parents := func(l *Locations) map[string]string {
		loc, err := l.Get(ctx, "cal")
		if err != nil {
			t.Fatal(err)
		}
		out := map[string]string{}
		for _, w := range loc.Worktrees {
			out[w.Name] = w.Parent
		}
		return out
	}
	got := parents(NewLocations(file))
	if got["listing"] != "" || got["listing-service"] != a.Path || got["listing-ui"] != b.Path {
		t.Fatalf("parents = %v", got)
	}

	// The middle one goes: its child is at the top, and the parent it had
	// keeps no link to it.
	if err := l.RemoveWorktree(ctx, "cal", "listing-service", true); err != nil {
		t.Fatal(err)
	}
	got = parents(l)
	if got["listing-ui"] != "" {
		t.Fatalf("after removal: %v", got)
	}
	saved, _ := l.read()
	if len(saved[0].Parents) != 0 {
		t.Fatalf("kept links: %v", saved[0].Parents)
	}
}

func TestWithParentsSkipsGoneParentsMainAndLoops(t *testing.T) {
	wts := []Worktree{{Path: "/r", Main: true}, {Path: "/a"}, {Path: "/b"}, {Path: "/c"}, {Path: "/d"}}
	withParents(wts, map[string]string{
		"/a": "/r",    // the main checkout is no parent
		"/b": "/gone", // nor is a worktree that went
		"/c": "/d",    // c and d point at each other
		"/d": "/c",
	})
	for _, w := range wts {
		if w.Parent != "" {
			t.Fatalf("%s has parent %q", w.Path, w.Parent)
		}
	}
	wts = []Worktree{{Path: "/a"}, {Path: "/b"}}
	withParents(wts, map[string]string{"/b": "/a"})
	if wts[1].Parent != "/a" {
		t.Fatalf("b = %+v", wts[1])
	}
}

func TestATaskHandedOffFromAnAgentNestsUnderItsWorktree(t *testing.T) {
	c, _ := servedBox(t)
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	var first, second, loose Task
	if status := call(t, c, "POST", "/v1/tasks", "", TaskRequest{Location: "cal", Name: "listing", Command: "cat"}, &first); status != 200 {
		t.Fatalf("first: %d", status)
	}
	if status := call(t, c, "POST", "/v1/tasks", "", TaskRequest{Location: "cal", Name: "listing-service", Command: "cat", FromSession: first.Session.Name}, &second); status != 200 {
		t.Fatalf("second: %d", status)
	}
	if second.Worktree.Parent != first.Worktree.Path {
		t.Fatalf("handed off: parent = %q, want %q", second.Worktree.Parent, first.Worktree.Path)
	}

	// From a session in the main checkout, or one that is gone: no parent.
	var shell Session
	if status := call(t, c, "POST", "/v1/sessions", "", SessionRequest{Location: "cal", Command: "cat"}, &shell); status != 200 || shell.Name == "" {
		t.Fatalf("shell: %d %+v", status, shell)
	}
	if status := call(t, c, "POST", "/v1/tasks", "", TaskRequest{Location: "cal", Name: "docs", Command: "cat", FromSession: shell.Name}, &loose); status != 200 || loose.Worktree.Parent != "" {
		t.Fatalf("from main: %d %+v", status, loose.Worktree)
	}
	if status := call(t, c, "POST", "/v1/tasks", "", TaskRequest{Location: "cal", Name: "ghost", Command: "cat", FromSession: "no-such-session"}, &loose); status != 200 || loose.Worktree.Parent != "" {
		t.Fatalf("from a gone session: %d %+v", status, loose.Worktree)
	}

	// The listing says so too.
	listed := worktreesOf(t, c, "cal")
	if len(listed) < 4 {
		t.Fatalf("listed %d worktrees", len(listed))
	}
	for _, w := range listed {
		if want := map[string]string{"listing-service": first.Worktree.Path}[w.Name]; w.Parent != want {
			t.Fatalf("%s: parent = %q, want %q", w.Name, w.Parent, want)
		}
	}
}

func TestAWorktreeMadeWithAParentNestsUnderIt(t *testing.T) {
	c, _ := servedBox(t)
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	var base, layer Worktree
	if status := call(t, c, "POST", "/v1/locations/cal/worktrees", "", WorktreeRequest{Name: "listing"}, &base); status != 200 {
		t.Fatalf("base: %d", status)
	}
	if status := call(t, c, "POST", "/v1/locations/cal/worktrees", "", WorktreeRequest{Name: "listing-service", Base: base.Branch, Parent: "listing"}, &layer); status != 200 {
		t.Fatalf("layer: %d", status)
	}
	if layer.Parent != base.Path {
		t.Fatalf("parent = %q, want %q", layer.Parent, base.Path)
	}

	// No such worktree, or the main checkout: refused, and nothing is made.
	var main string
	for _, w := range worktreesOf(t, c, "cal") {
		if w.Main {
			main = w.Name
		}
	}
	for _, parent := range []string{"no-such", main} {
		if status := call(t, c, "POST", "/v1/locations/cal/worktrees", "", WorktreeRequest{Name: "orphan", Parent: parent}, nil); status != 400 {
			t.Fatalf("parent %q: %d, want 400", parent, status)
		}
	}
	nested := false
	for _, w := range worktreesOf(t, c, "cal") {
		if w.Name == "orphan" {
			t.Fatal("a refused worktree was made")
		}
		if w.Name == "listing-service" {
			nested = w.Parent == base.Path
		}
	}
	if !nested {
		t.Fatal("the listing does not nest listing-service under listing")
	}
}

// worktreesOf lists location name's worktrees as the box does.
func worktreesOf(t *testing.T, c *wire.Client, name string) []Worktree {
	t.Helper()
	var all []Location
	if status := call(t, c, "GET", "/v1/locations", "", nil, &all); status != 200 {
		t.Fatalf("locations: %d", status)
	}
	for _, l := range all {
		if l.Name == name {
			return l.Worktrees
		}
	}
	t.Fatalf("no location %q", name)
	return nil
}
