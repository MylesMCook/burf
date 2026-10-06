package box

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"
)

func folderURL(dir string) string { return wtBase + "files?dir=" + url.QueryEscape(dir) }

// names is a folder's entries as "name/" for a folder, "name" for a file.
func names(f WorktreeFolder) []string {
	out := []string{}
	for _, e := range f.Entries {
		if e.Dir {
			out = append(out, e.Name+"/")
		} else {
			out = append(out, e.Name)
		}
	}
	return out
}

func TestWorktreeFolderListsOneLevel(t *testing.T) {
	c, dir := fileBox(t)
	get := func(d string) WorktreeFolder {
		t.Helper()
		var f WorktreeFolder
		if status := call(t, c, "GET", folderURL(d), "", nil, &f); status != 200 {
			t.Fatalf("files?dir=%s: %d", d, status)
		}
		return f
	}
	// Tracked: a nested app, numbered folders, a Next.js-style [id] folder.
	put(t, dir, "apps/web/lib/payments/webhook.ts", "x")
	put(t, dir, "apps/web/lib/log.ts", "x")
	put(t, dir, "apps/web/app/[id]/page.tsx", "x")
	put(t, dir, "apps/web/package.json", "{}")
	put(t, dir, "pkgs/v10/a.ts", "x")
	put(t, dir, "pkgs/v2/a.ts", "x")
	put(t, dir, "pkgs/V1/a.ts", "x")
	put(t, dir, "Makefile", "all:")
	put(t, dir, "gone.ts", "x")
	put(t, dir, ".gitignore", "dist/\n*.log\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-q", "-m", "tracked")
	// Deleted since (still in git's index until committed): not listed.
	os.Remove(filepath.Join(dir, "gone.ts"))
	// Untracked, not ignored: listed, a new folder too, deep inside.
	put(t, dir, "apps/web/lib/payments/idempotency.ts", "x")
	put(t, dir, "notes/drafts/deep/plan.md", "x")
	put(t, dir, "todo.md", "x")
	// Ignored: never listed.
	put(t, dir, "dist/bundle.js", "x")
	put(t, dir, "apps/web/debug.log", "x")

	top := get("")
	if want := []string{"apps/", "notes/", "pkgs/", ".gitignore", "Makefile", "README", "todo.md"}; !reflect.DeepEqual(names(top), want) {
		t.Fatalf("top: %v, want %v", names(top), want)
	}
	if top.Dir != "" || top.Truncated {
		t.Fatalf("top: %+v", top)
	}
	for _, e := range top.Entries {
		if e.Dir && !e.Children {
			t.Fatalf("%s has no children", e.Name)
		}
	}
	if got, want := names(get("apps/web")), []string{"app/", "lib/", "package.json"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("apps/web: %v, want %v", got, want)
	}
	if got, want := names(get("apps/web/lib/payments/")), []string{"idempotency.ts", "webhook.ts"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("payments: %v, want %v", got, want)
	}
	// Numbers by value, case aside.
	if got, want := names(get("pkgs")), []string{"V1/", "v2/", "v10/"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("pkgs: %v, want %v", got, want)
	}
	// A folder name with pattern characters is taken literally.
	if got, want := names(get("apps/web/app/[id]")), []string{"page.tsx"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("[id]: %v, want %v", got, want)
	}
	// Inside a folder git doesn't track at all.
	if got, want := names(get("notes")), []string{"drafts/"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("notes: %v, want %v", got, want)
	}
	if got, want := names(get("notes/drafts/deep")), []string{"plan.md"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("notes/drafts/deep: %v, want %v", got, want)
	}
	// An ignored folder has nothing to list.
	if got := names(get("dist")); len(got) != 0 {
		t.Fatalf("dist: %v", got)
	}
}

func TestWorktreeFolderPathRules(t *testing.T) {
	c, dir := fileBox(t)
	put(t, dir, "src/app.ts", "x")
	outside := t.TempDir()
	os.WriteFile(filepath.Join(outside, "key.txt"), []byte("k"), 0o600)
	os.Symlink(outside, filepath.Join(dir, "escape"))
	os.Symlink(filepath.Join(dir, "src"), filepath.Join(dir, "inner"))
	for _, tc := range []struct {
		dir    string
		status int
	}{
		{"", 200},
		{".", 200},
		{"src", 200},
		{"src/", 200},
		{"inner", 200},
		{"../", 403},
		{"src/../..", 403},
		{".git", 403},
		{".git/refs", 403},
		{"/etc", 400},
		{"src/app.ts", 400},
		{"nope", 404},
		{"escape", 403},
	} {
		code, out, _ := fileCall(t, c, "GET", folderURL(tc.dir), nil, nil)
		if code != tc.status {
			t.Errorf("dir=%q: %d %v, want %d", tc.dir, code, out, tc.status)
		}
	}
	// A link to a folder inside lists that folder.
	var f WorktreeFolder
	call(t, c, "GET", folderURL("inner"), "", nil, &f)
	if !reflect.DeepEqual(names(f), []string{"app.ts"}) || f.Dir != "src" {
		t.Fatalf("inner: %+v", f)
	}
}

// Past maxListedFiles, ⌘P's list drops the folders late in the alphabet;
// a folder at a time doesn't.
func TestWorktreeFolderPastTheCap(t *testing.T) {
	if testing.Short() {
		t.Skip("makes 20,000 files")
	}
	c, dir := fileBox(t)
	for i := 0; i < maxListedFiles+50; i++ {
		put(t, dir, fmt.Sprintf("aaa/m%03d/f%05d.ts", i/100, i), "")
	}
	put(t, dir, "zzz/late.ts", "x")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-q", "-m", "big")
	put(t, dir, "zz-new.ts", "x")

	all, more, err := gitFiles(t.Context(), dir)
	if err != nil || !more || len(all) != maxListedFiles {
		t.Fatalf("gitFiles: %d, %v, %v", len(all), more, err)
	}
	// git lists the untracked first, then the tracked in order, so the
	// cap cuts the tracked folders late in the alphabet.
	if slices.Contains(all, "zzz/late.ts") {
		t.Fatal("the capped list has zzz/late.ts")
	}
	var top WorktreeFolder
	if status := call(t, c, "GET", folderURL(""), "", nil, &top); status != 200 {
		t.Fatalf("top: %d", status)
	}
	if want := []string{"aaa/", "zzz/", "README", "zz-new.ts"}; !reflect.DeepEqual(names(top), want) {
		t.Fatalf("top: %v, want %v", names(top), want)
	}
	var late WorktreeFolder
	call(t, c, "GET", folderURL("zzz"), "", nil, &late)
	if !reflect.DeepEqual(names(late), []string{"late.ts"}) {
		t.Fatalf("zzz: %v", names(late))
	}
	var aaa WorktreeFolder
	call(t, c, "GET", folderURL("aaa"), "", nil, &aaa)
	if len(aaa.Entries) != (maxListedFiles+50+99)/100 || aaa.Entries[0].Name != "m000" || aaa.Truncated {
		t.Fatalf("aaa: %d entries, %+v", len(aaa.Entries), aaa.Entries[:2])
	}
}

// A new file made through the box shows in its folder at once, despite
// the cache.
func TestWorktreeFolderSeesNewFile(t *testing.T) {
	c, dir := fileBox(t)
	put(t, dir, "src/app.ts", "x")
	var f WorktreeFolder
	call(t, c, "GET", folderURL("src"), "", nil, &f)
	if !reflect.DeepEqual(names(f), []string{"app.ts"}) {
		t.Fatalf("src: %v", names(f))
	}
	code, _, _ := fileCall(t, c, "PUT", fileURL("src/new.ts"), map[string][]string{"If-None-Match": {"*"}}, map[string]string{"content": ""})
	if code != 200 {
		t.Fatalf("new file: %d", code)
	}
	call(t, c, "GET", folderURL("src"), "", nil, &f)
	if !reflect.DeepEqual(names(f), []string{"app.ts", "new.ts"}) {
		t.Fatalf("src after: %v", names(f))
	}
	// Making it again is refused, and doesn't touch it.
	if code, _, _ := fileCall(t, c, "PUT", fileURL("src/new.ts"), map[string][]string{"If-None-Match": {"*"}}, map[string]string{"content": "y"}); code != 412 {
		t.Fatalf("again: %d", code)
	}
}

func TestWithTouchedAddsWhatTheCapLost(t *testing.T) {
	all := []string{"a.ts", "b.ts"}
	got := withTouched(all, []FileTurn{
		{TouchedFile: TouchedFile{Path: "b.ts"}},
		{TouchedFile: TouchedFile{Path: "zz/new.ts"}},
		{TouchedFile: TouchedFile{Path: "zz/gone.ts", Deleted: true}},
	})
	if want := []string{"a.ts", "b.ts", "zz/new.ts"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	if !reflect.DeepEqual(all, []string{"a.ts", "b.ts"}) {
		t.Fatalf("all changed: %v", all)
	}
}

func TestNaturalCompare(t *testing.T) {
	for _, tc := range []struct {
		a, b string
		want int
	}{
		{"analytics-2", "analytics-10", -1},
		{"v10", "v9", 1},
		{"README", "readme", 0},
		{"a", "ab", -1},
		{"file007", "file7", 0},
		{"Zeta", "alpha", 1},
	} {
		if got := naturalCompare(tc.a, tc.b); got != tc.want {
			t.Errorf("%s vs %s: %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
	es := []WorktreeEntry{{Name: "b.ts"}, {Name: "lib", Dir: true}, {Name: "A.ts"}, {Name: "app", Dir: true}}
	sortFolder(es)
	if got := strings.Join(names(WorktreeFolder{Entries: es}), " "); got != "app/ lib/ A.ts b.ts" {
		t.Fatalf("sorted: %s", got)
	}
}
