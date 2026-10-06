package box

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/transcript"
	"github.com/sean-brydon/berthd/internal/wire"
)

// fileBox serves a box with one repository location, "shop", and a
// worktree of it, "fix", with no session in it. It returns the client and
// the worktree's folder.
func fileBox(t *testing.T) (*wire.Client, string) {
	t.Helper()
	c, _ := servedBox(t)
	repo := gitRepo(t)
	if status := call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "shop", "path": repo}, nil); status != 200 {
		t.Fatalf("add location: %d", status)
	}
	var wt Worktree
	if status := call(t, c, "POST", "/v1/locations/shop/worktrees", "", WorktreeRequest{Name: "fix"}, &wt); status != 200 {
		t.Fatalf("add worktree: %d", status)
	}
	dir, err := filepath.EvalSymlinks(wt.Path)
	if err != nil {
		t.Fatal(err)
	}
	return c, dir
}

// fileCall makes one request with headers and returns its status and its
// JSON answer.
func fileCall(t *testing.T, c *wire.Client, method, path string, header http.Header, in any) (int, map[string]any, http.Header) {
	t.Helper()
	var body io.Reader
	if in != nil {
		b, _ := json.Marshal(in)
		body = bytes.NewReader(b)
	}
	resp, err := c.DoWithHeader(context.Background(), method, path, body, header)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out, resp.Header
}

const wtBase = "/v1/locations/shop/worktrees/fix/"

func fileURL(p string, extra ...string) string {
	return wtBase + "file?path=" + url.QueryEscape(p) + strings.Join(extra, "")
}

func put(t *testing.T, dir, rel, content string) {
	t.Helper()
	p := filepath.Join(dir, filepath.FromSlash(rel))
	os.MkdirAll(filepath.Dir(p), 0o755)
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestCleanWorktreePathRules(t *testing.T) {
	for _, tc := range []struct {
		in, want string
		status   int
	}{
		{"src/app.ts", "src/app.ts", 0},
		{"src/./lib/../app.ts", "src/app.ts", 0},
		{"a//b.ts", "a/b.ts", 0},
		{".gitignore", ".gitignore", 0},
		{".github/workflows/ci.yml", ".github/workflows/ci.yml", 0},
		{"", "", 400},
		{"a\x00b", "", 400},
		{".", "", 400},
		{"/etc/passwd", "", 400},
		{"../outside.txt", "", 403},
		{"src/../../outside.txt", "", 403},
		{"..", "", 403},
		{".git/config", "", 403},
		{"sub/.git/HEAD", "", 403},
		{".GIT/config", "", 403},
		{".git", "", 403},
	} {
		got, err := cleanWorktreePath(tc.in)
		status := 0
		if err != nil {
			status = statusFor(err)
		}
		if got != tc.want || status != tc.status {
			t.Errorf("%q: got %q, %d; want %q, %d", tc.in, got, status, tc.want, tc.status)
		}
	}
}

// Every symlink on the way is followed, and the file must still be inside
// the worktree and outside .git.
func TestWorktreeFileStaysInsideAfterSymlinks(t *testing.T) {
	root, _ := filepath.EvalSymlinks(t.TempDir())
	wt := filepath.Join(root, "wt")
	outside := filepath.Join(root, "secret")
	os.MkdirAll(filepath.Join(wt, "src"), 0o755)
	os.MkdirAll(filepath.Join(wt, ".git"), 0o755)
	os.MkdirAll(outside, 0o755)
	os.WriteFile(filepath.Join(outside, "key.txt"), []byte("k"), 0o600)
	os.WriteFile(filepath.Join(wt, ".git", "config"), []byte("[core]"), 0o644)
	os.WriteFile(filepath.Join(wt, "src", "app.ts"), []byte("x"), 0o644)
	os.Symlink(filepath.Join(outside, "key.txt"), filepath.Join(wt, "key.txt"))
	os.Symlink(outside, filepath.Join(wt, "vendor"))
	os.Symlink(filepath.Join(wt, "src", "app.ts"), filepath.Join(wt, "alias.ts"))
	os.Symlink(filepath.Join(wt, ".git"), filepath.Join(wt, "gitdir"))
	os.Symlink("../../secret/key.txt", filepath.Join(wt, "src", "rel.txt"))
	os.Symlink("../../secret/missing.txt", filepath.Join(wt, "src", "dangling.txt"))

	for _, tc := range []struct {
		path   string
		status int
		abs    string
	}{
		{"src/app.ts", 0, filepath.Join(wt, "src", "app.ts")},
		{"alias.ts", 0, filepath.Join(wt, "src", "app.ts")},
		{"src/new.ts", 0, filepath.Join(wt, "src", "new.ts")},
		{"key.txt", 403, ""},
		{"vendor/key.txt", 403, ""},
		{"vendor/new.txt", 403, ""},
		{"src/rel.txt", 403, ""},
		{"src/dangling.txt", 403, ""},
		{"gitdir/config", 403, ""},
		{"nowhere/new.ts", 404, ""},
	} {
		abs, _, err := worktreeFile(wt, tc.path)
		status := 0
		if err != nil {
			status = statusFor(err)
		}
		if status != tc.status || abs != tc.abs {
			t.Errorf("%s: got %q %d (%v), want %q %d", tc.path, abs, status, err, tc.abs, tc.status)
		}
	}
}

func TestWorktreeFileReadWriteWithEtags(t *testing.T) {
	c, dir := fileBox(t)
	put(t, dir, "apps/web/webhook.ts", "export const a = 1;\n")
	os.WriteFile(filepath.Join(dir, "run.sh"), []byte("#!/bin/sh\necho hi\n"), 0o755)

	status, got, _ := fileCall(t, c, "GET", fileURL("apps/web/webhook.ts"), nil, nil)
	if status != 200 || got["content"] != "export const a = 1;\n" || got["etag"] == "" || got["mtime"].(float64) <= 0 || got["path"] != "apps/web/webhook.ts" {
		t.Fatalf("get: %d %v", status, got)
	}
	etag := got["etag"].(string)

	// A stat is the etag alone, for polling.
	if status, s, _ := fileCall(t, c, "GET", fileURL("apps/web/webhook.ts", "&stat=1"), nil, nil); status != 200 || s["etag"] != etag || s["content"] != nil {
		t.Fatalf("stat: %d %v", status, s)
	}

	body := map[string]string{"content": "export const a = 2;\n"}
	// A write must say which version it replaces.
	if status, e, _ := fileCall(t, c, "PUT", fileURL("apps/web/webhook.ts"), nil, body); status != http.StatusPreconditionRequired || e["code"] != "bad_request" {
		t.Fatalf("no precondition: %d %v", status, e)
	}
	// One made against another version is refused, with the file as it is.
	status, e, _ := fileCall(t, c, "PUT", fileURL("apps/web/webhook.ts"), http.Header{"If-Match": {`"sha256-0000"`}}, body)
	if status != http.StatusPreconditionFailed || e["code"] != CodeFileChanged || e["etag"] != etag || e["content"] != "export const a = 1;\n" {
		t.Fatalf("stale: %d %v", status, e)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "apps/web/webhook.ts")); string(b) != "export const a = 1;\n" {
		t.Fatalf("a refused write changed the file: %q", b)
	}
	// The right version lands, and answers with the new etag.
	status, w, h := fileCall(t, c, "PUT", fileURL("apps/web/webhook.ts"), http.Header{"If-Match": {`"` + etag + `"`}}, body)
	if status != 200 || w["etag"] == etag || w["etag"] == "" || h.Get("ETag") != `"`+w["etag"].(string)+`"` {
		t.Fatalf("put: %d %v", status, w)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "apps/web/webhook.ts")); string(b) != "export const a = 2;\n" {
		t.Fatalf("on disk: %q", b)
	}
	// The same etag again is now stale.
	if status, _, _ := fileCall(t, c, "PUT", fileURL("apps/web/webhook.ts"), http.Header{"If-Match": {etag}}, body); status != http.StatusPreconditionFailed {
		t.Fatalf("replay: %d", status)
	}
	// A write keeps the file's mode.
	_, s, _ := fileCall(t, c, "GET", fileURL("run.sh"), nil, nil)
	if status, _, _ := fileCall(t, c, "PUT", fileURL("run.sh"), http.Header{"If-Match": {s["etag"].(string)}}, map[string]string{"content": "#!/bin/sh\necho bye\n"}); status != 200 {
		t.Fatalf("put run.sh: %d", status)
	}
	if st, _ := os.Stat(filepath.Join(dir, "run.sh")); st.Mode().Perm() != 0o755 {
		t.Fatalf("mode %v", st.Mode())
	}
	// If-None-Match: * makes a file, and only a new one.
	if status, _, _ := fileCall(t, c, "PUT", fileURL("apps/web/new.ts"), http.Header{"If-None-Match": {"*"}}, body); status != 200 {
		t.Fatalf("create: %d", status)
	}
	if status, e, _ := fileCall(t, c, "PUT", fileURL("apps/web/new.ts"), http.Header{"If-None-Match": {"*"}}, body); status != http.StatusPreconditionFailed || e["content"] != body["content"] {
		t.Fatalf("create over: %d %v", status, e)
	}
	// A file deleted under you is a refused write that says so.
	_, s, _ = fileCall(t, c, "GET", fileURL("apps/web/new.ts"), nil, nil)
	os.Remove(filepath.Join(dir, "apps/web/new.ts"))
	if status, e, _ := fileCall(t, c, "PUT", fileURL("apps/web/new.ts"), http.Header{"If-Match": {s["etag"].(string)}}, body); status != http.StatusPreconditionFailed || e["deleted"] != true {
		t.Fatalf("deleted: %d %v", status, e)
	}
	if status, e, _ := fileCall(t, c, "GET", fileURL("apps/web/new.ts"), nil, nil); status != 404 || e["code"] != "not_found" {
		t.Fatalf("gone: %d %v", status, e)
	}
	// Refused paths, over the wire.
	for p, want := range map[string]int{".git/config": 403, "../cal/README": 403, "/etc/hosts": 400, "apps": 400} {
		if status, _, _ := fileCall(t, c, "GET", fileURL(p), nil, nil); status != want {
			t.Errorf("GET %s: %d, want %d", p, status, want)
		}
		if status, _, _ := fileCall(t, c, "PUT", fileURL(p), http.Header{"If-Match": {"*"}}, body); status != want && !(p == "apps" && status == 412) {
			t.Errorf("PUT %s: %d, want %d", p, status, want)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, ".git", "config")); err == nil {
		t.Fatal(".git written")
	}
}

func TestWorktreeFileLargeAndBinary(t *testing.T) {
	c, dir := fileBox(t)
	put(t, dir, "big.log", strings.Repeat("a line of a large log file\n", (maxEditableFile/27)+10))
	put(t, dir, "data.bin", "abc\x00def")
	put(t, dir, "latin1.txt", "caf\xe9\n")
	png := append([]byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), bytes.Repeat([]byte{1}, 64)...)
	os.WriteFile(filepath.Join(dir, "logo.png"), png, 0o644)
	put(t, dir, "icon.svg", `<svg xmlns="http://www.w3.org/2000/svg"/>`)

	_, big, _ := fileCall(t, c, "GET", fileURL("big.log"), nil, nil)
	if big["too_large"] != true || big["content"] != nil || !strings.Contains(big["reason"].(string), "MB") || big["etag"] == "" {
		t.Fatalf("big: %v", big)
	}
	body := map[string]string{"content": strings.Repeat("x", maxEditableFile+1)}
	if status, _, _ := fileCall(t, c, "PUT", fileURL("big.log"), http.Header{"If-Match": {big["etag"].(string)}}, body); status != http.StatusRequestEntityTooLarge {
		t.Fatalf("big write: %d", status)
	}
	for _, p := range []string{"data.bin", "latin1.txt"} {
		if _, b, _ := fileCall(t, c, "GET", fileURL(p), nil, nil); b["binary"] != true || b["content"] != nil || b["reason"] == nil || b["image"] != nil {
			t.Fatalf("%s: %v", p, b)
		}
	}
	if _, b, _ := fileCall(t, c, "GET", fileURL("logo.png"), nil, nil); b["binary"] != true || b["image"] != "image/png" || b["content"] != nil {
		t.Fatalf("png: %v", b)
	}
	resp, err := c.Do(context.Background(), "GET", fileURL("logo.png", "&raw=1"), nil)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/png" || !bytes.Equal(raw, png) || resp.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("raw: %d %s", resp.StatusCode, resp.Header.Get("Content-Type"))
	}
	// Only pictures come raw.
	if status, _, _ := fileCall(t, c, "GET", fileURL("data.bin", "&raw=1"), nil, nil); status != http.StatusUnsupportedMediaType {
		t.Fatalf("raw bin: %d", status)
	}
	// An SVG is text: it opens in the editor.
	if _, s, _ := fileCall(t, c, "GET", fileURL("icon.svg"), nil, nil); s["content"] == nil || s["binary"] != nil {
		t.Fatalf("svg: %v", s)
	}
}

// ⌘P lists a worktree's files with no session in it: tracked and untracked
// ones git doesn't ignore, never .git, best match first.
func TestWorktreeFilesNeedNoSession(t *testing.T) {
	c, dir := fileBox(t)
	put(t, dir, "apps/web/lib/payments/webhook.ts", "x")
	put(t, dir, "apps/web/app/api/webhooks/payments/route.ts", "x")
	put(t, dir, "docs/paywall.md", "x")
	put(t, dir, ".gitignore", "dist/\n")
	put(t, dir, "dist/bundle.js", "x")
	var list FileList
	if status := call(t, c, "GET", wtBase+"files?q=webhook&limit=10", "", nil, &list); status != 200 {
		t.Fatalf("files: %d", status)
	}
	if len(list.Files) == 0 || list.Files[0] != "apps/web/lib/payments/webhook.ts" {
		t.Fatalf("webhook: %v", list.Files)
	}
	for _, f := range list.Files {
		if strings.HasPrefix(f, "dist/") || strings.HasPrefix(f, ".git/") {
			t.Fatalf("listed %s", f)
		}
	}
	if status := call(t, c, "GET", "/v1/locations/shop/worktrees/nope/files", "", nil, nil); status != 404 {
		t.Fatalf("unknown worktree: %d", status)
	}
	// Nothing touched: an empty list, not null.
	var touched struct {
		Files []TouchedFile `json:"files"`
	}
	if status := call(t, c, "GET", wtBase+"touched", "", nil, &touched); status != 200 || touched.Files == nil || len(touched.Files) != 0 {
		t.Fatalf("touched: %d %+v", status, touched)
	}
}

func TestRankFilesFavoursTheFileName(t *testing.T) {
	all := []string{
		"apps/web/app/api/webhooks/payments/route.ts",
		"apps/web/lib/payments/webhook.test.ts",
		"apps/web/lib/payments/webhook.ts",
		"packages/web-hooks/index.ts",
		"README.md",
	}
	if got := RankFiles(all, "paywh", 10); len(got) < 2 || got[0] != "apps/web/lib/payments/webhook.ts" {
		t.Fatalf("paywh: %v", got)
	}
	if got := RankFiles(all, "webhook", 2); !reflect.DeepEqual(got, []string{"apps/web/lib/payments/webhook.ts", "apps/web/lib/payments/webhook.test.ts"}) {
		t.Fatalf("webhook: %v", got)
	}
	if got := RankFiles(all, "readme", 10); !reflect.DeepEqual(got, []string{"README.md"}) {
		t.Fatalf("readme: %v", got)
	}
	if got := RankFiles(all, "zzz", 10); len(got) != 0 {
		t.Fatalf("zzz: %v", got)
	}
	if got := RankFiles(all, "", 2); len(got) != 2 {
		t.Fatalf("empty: %v", got)
	}
}

func TestLineCounts(t *testing.T) {
	for _, tc := range []struct {
		a, b           string
		added, removed int
	}{
		{"", "", 0, 0},
		{"", "a\nb\n", 2, 0},
		{"a\nb\n", "", 0, 2},
		{"a\nb\nc\n", "a\nb\nc\n", 0, 0},
		{"a\nb\nc\n", "a\nB\nc\n", 1, 1},
		{"a\nb\nc\n", "a\nb\nx\ny\nc\n", 2, 0},
		{"a\nb\nc\nd\n", "b\nc\n", 0, 2},
		{"x\na\nb\n", "a\nb\ny\n", 1, 1},
		{"a\nb", "a\nb\n", 0, 0},
	} {
		if added, removed := lineCounts(tc.a, tc.b); added != tc.added || removed != tc.removed {
			t.Errorf("%q → %q: +%d −%d, want +%d −%d", tc.a, tc.b, added, removed, tc.added, tc.removed)
		}
	}
	// Past the bound, it still answers.
	var a, b strings.Builder
	for i := range 6000 {
		a.WriteString("a" + string(rune('0'+i%10)) + "\n")
		b.WriteString("b" + string(rune('0'+i%10)) + "\n")
	}
	if added, removed := lineCounts(a.String(), b.String()); added != 6000 || removed != 6000 {
		t.Fatalf("rough: +%d −%d", added, removed)
	}
}

// A turn's file, against the worktree as it is: counts from the file as
// the turn found it (Claude Code's record), from the last commit when the
// record has none, and never for a file outside the worktree or in .git.
func TestTouchedFileCountsFromTheTurnsBase(t *testing.T) {
	repo := gitRepo(t)
	root, _ := filepath.EvalSymlinks(repo)
	put(t, root, "src/webhook.ts", "one\ntwo\nthree\nfour\n")
	gitIn(t, root, "add", ".")
	gitIn(t, root, "commit", "-q", "-m", "webhook")
	// Since the commit: an earlier turn's change, then this turn's.
	put(t, root, "src/webhook.ts", "one\nTWO\nthree\nfour\nfive\nsix\n")
	before := "one\nTWO\nthree\nfour\n"
	ctx := context.Background()

	ft, ok := touchedFile(ctx, root, root, transcript.TurnFile{Path: filepath.Join(root, "src/webhook.ts"), Original: &before, At: 5})
	if !ok || ft.Path != "src/webhook.ts" || ft.Base != "turn" || ft.Added != 2 || ft.Removed != 0 || *ft.Before != before || ft.At != 5 {
		t.Fatalf("turn base: %+v", ft)
	}
	// No original kept (Codex): against the last commit, path relative to
	// the session's folder.
	ft, ok = touchedFile(ctx, root, filepath.Join(root, "src"), transcript.TurnFile{Path: "webhook.ts", Added: 9, Removed: 9})
	if !ok || ft.Base != "head" || ft.Added != 3 || ft.Removed != 1 || ft.At == 0 {
		t.Fatalf("head base: %+v", ft)
	}
	// Made this turn.
	put(t, root, "src/new.ts", "a\nb\n")
	ft, _ = touchedFile(ctx, root, root, transcript.TurnFile{Path: filepath.Join(root, "src/new.ts"), Created: true})
	if !ft.Created || ft.Before != nil || ft.Added != 2 || ft.Removed != 0 {
		t.Fatalf("created: %+v", ft)
	}
	// Untracked, no record of its start: made this turn as far as git knows.
	put(t, root, "src/untracked.ts", "a\n")
	ft, _ = touchedFile(ctx, root, root, transcript.TurnFile{Path: filepath.Join(root, "src/untracked.ts")})
	if !ft.Created || ft.Added != 1 {
		t.Fatalf("untracked: %+v", ft)
	}
	// Deleted since.
	gone := "x\ny\n"
	ft, ok = touchedFile(ctx, root, root, transcript.TurnFile{Path: filepath.Join(root, "src/gone.ts"), Original: &gone})
	if !ok || !ft.Deleted || ft.Removed != 2 {
		t.Fatalf("deleted: %+v", ft)
	}
	for _, p := range []string{"/etc/hosts", filepath.Join(root, ".git", "config"), filepath.Join(filepath.Dir(root), "elsewhere.ts")} {
		if _, ok := touchedFile(ctx, root, root, transcript.TurnFile{Path: p}); ok {
			t.Errorf("%s counted", p)
		}
	}
}

// Over the wire: a Claude session in the worktree, its record in Claude
// Code's folder, and ⌘P's list and the File tab's turn read from it.
func TestTouchedReadsTheAgentsRecord(t *testing.T) {
	bin := t.TempDir()
	// A stand-in for claude that only waits: the session runs it.
	os.WriteFile(filepath.Join(bin, "claude"), []byte("#!/bin/sh\nexec sleep 600\n"), 0o755)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	conf := t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", conf)

	c, dir := fileBox(t)
	put(t, dir, "src/webhook.ts", "one\ntwo\n")
	var sess Session
	if status := call(t, c, "POST", "/v1/sessions", "", SessionRequest{Location: "shop/fix", Command: "claude"}, &sess); status != 200 {
		t.Fatalf("session: %d", status)
	}
	time.Sleep(50 * time.Millisecond)
	now := time.Now().UTC()
	ts := func(d time.Duration) string { return now.Add(d).Format(time.RFC3339Nano) }
	line := func(v map[string]any) string { b, _ := json.Marshal(v); return string(b) }
	type m = map[string]any
	rec := strings.Join([]string{
		line(m{"type": "user", "timestamp": ts(time.Second), "message": m{"role": "user", "content": "Make the webhook idempotent"}}),
		line(m{"type": "assistant", "timestamp": ts(2 * time.Second), "message": m{"role": "assistant", "content": []m{{"type": "tool_use", "id": "e1", "name": "Edit", "input": m{"file_path": filepath.Join(dir, "src/webhook.ts"), "old_string": "two", "new_string": "two\nthree"}}}}}),
		line(m{"type": "user", "timestamp": ts(3 * time.Second), "message": m{"role": "user", "content": []m{{"type": "tool_result", "tool_use_id": "e1", "content": "ok"}}}, "toolUseResult": m{"originalFile": "one\ntwo\n"}}),
	}, "\n") + "\n"
	put(t, dir, "src/webhook.ts", "one\ntwo\nthree\n")
	proj := transcript.ClaudeDir(sess.Dir)
	os.MkdirAll(proj, 0o755)
	os.WriteFile(filepath.Join(proj, "conv.jsonl"), []byte(rec), 0o600)

	var touched struct {
		Files []TouchedFile `json:"files"`
	}
	if status := call(t, c, "GET", wtBase+"touched", "", nil, &touched); status != 200 {
		t.Fatalf("touched: %d", status)
	}
	if len(touched.Files) != 1 {
		t.Fatalf("touched: %+v", touched.Files)
	}
	f := touched.Files[0]
	if f.Path != "src/webhook.ts" || f.Added != 1 || f.Removed != 0 || f.Agent != "claude" || f.Session != sess.Name || f.Base != "turn" || f.At == 0 || !f.Live {
		t.Fatalf("touched: %+v", f)
	}
	_, got, _ := fileCall(t, c, "GET", fileURL("src/webhook.ts", "&turn=1"), nil, nil)
	turn, _ := got["turn"].(map[string]any)
	if turn == nil || turn["before"] != "one\ntwo\n" || turn["added"].(float64) != 1 {
		t.Fatalf("file turn: %v", got)
	}
}
