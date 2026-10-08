package box

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/events"
	"github.com/MylesMCook/burf/internal/wire"
)

const barChart = `{"$schema": "berth.chart/v1", "type": "bar", "title": "p95", "x": "endpoint",
 "y": [{"key": "before", "color": "muted"}, "after"], "units": "ms", "better": "lower",
 "data": [{"endpoint": "/search", "before": 1240, "after": 410}, {"endpoint": "/cart", "before": 180, "after": 176}]}`

func newArtifactStore(t *testing.T) (*ArtifactStore, *events.Bus) {
	t.Helper()
	bus := &events.Bus{Sequence: true}
	return &ArtifactStore{Dir: t.TempDir(), Events: bus, Box: "devbox"}, bus
}

func TestArtifactAddUpdateAndVersions(t *testing.T) {
	s, _ := newArtifactStore(t)
	wt := "/work/acme-shop"
	a, changed, err := s.Add("shop", "search-perf", wt, ArtifactInput{Title: "p95 before and after", Name: "p95.json", Content: []byte(barChart), By: ArtifactBy{Session: "search-perf-claude", Agent: "claude"}})
	if err != nil || !changed {
		t.Fatalf("add: %v (changed %v)", err, changed)
	}
	if !ValidArtifactID(a.ID) || a.Kind != "chart" || a.Format != "chart" || a.Latest().N != 1 || a.By.Session != "search-perf-claude" {
		t.Fatalf("added %+v", a)
	}
	// The same content again is no new version; a retitle sticks.
	b, changed, err := s.Add("shop", "search-perf", wt, ArtifactInput{ID: a.ID, Title: "p95, before and after", Name: "p95.json", Content: []byte(barChart)})
	if err != nil || changed || b.Latest().N != 1 || b.Title != "p95, before and after" {
		t.Fatalf("same content: %+v changed=%v err=%v", b, changed, err)
	}
	// Twelve more versions: the first and the newest eight are kept.
	for i := 2; i <= 13; i++ {
		body := strings.Replace(barChart, `"after": 410`, `"after": `+itoa(400-i), 1)
		if _, changed, err := s.Add("shop", "search-perf", wt, ArtifactInput{ID: a.ID, Name: "p95.json", Content: []byte(body), Note: "run " + itoa(i)}); err != nil || !changed {
			t.Fatalf("version %d: %v", i, err)
		}
	}
	got, err := s.Get(a.ID, wt)
	if err != nil {
		t.Fatal(err)
	}
	var ns []int
	for _, v := range got.Versions {
		ns = append(ns, v.N)
	}
	if want := []int{1, 6, 7, 8, 9, 10, 11, 12, 13}; !equalInts(ns, want) {
		t.Fatalf("versions kept %v, want %v", ns, want)
	}
	files, _ := filepath.Glob(filepath.Join(s.Dir, a.ID, "v*.json"))
	if len(files) != 9 {
		t.Fatalf("%d version files on disk, want 9: %v", len(files), files)
	}
	if _, v, body, err := s.Content(a.ID, wt, 1); err != nil || v.N != 1 || string(body) != barChart {
		t.Fatalf("v1: %v %d", err, v.N)
	}
	if _, _, _, err := s.Content(a.ID, wt, 3); err == nil || !strings.Contains(err.Error(), "v3 isn't kept") {
		t.Fatalf("v3 should be gone: %v", err)
	}
	if _, v, _, _ := s.Content(a.ID, wt, 0); v.N != 13 || v.Note != "run 13" {
		t.Fatalf("latest = %+v", v)
	}
	// Another worktree can't see it, nor update it.
	if _, err := s.Get(a.ID, "/work/other"); err == nil {
		t.Fatal("another worktree read it")
	}
	if _, _, err := s.Add("shop", "other", "/work/other", ArtifactInput{ID: a.ID, Name: "p95.json", Content: []byte(barChart)}); err == nil {
		t.Fatal("another worktree updated it")
	}
	// A new kind for the same artifact is refused.
	if _, _, err := s.Add("shop", "search-perf", wt, ArtifactInput{ID: a.ID, Name: "t.csv", Content: []byte("a,b\n1,2")}); err == nil || !strings.Contains(err.Error(), "must be one too") {
		t.Fatalf("kind change: %v", err)
	}
	// It survives a restart.
	again := &ArtifactStore{Dir: s.Dir}
	if l := again.List(wt); len(l) != 1 || l[0].Latest().N != 13 {
		t.Fatalf("reloaded %+v", l)
	}
	// And goes with its worktree.
	if gone := again.RemoveWorktree(wt); len(gone) != 1 {
		t.Fatalf("removed %d", len(gone))
	}
	if _, err := os.Stat(filepath.Join(s.Dir, a.ID)); !os.IsNotExist(err) {
		t.Fatalf("its folder is still there: %v", err)
	}
}

func TestArtifactKinds(t *testing.T) {
	cases := []struct{ kind, name, body, wantKind, wantFormat string }{
		{"", "p95.json", barChart, "chart", "chart"},
		{"", "tests.csv", "suite,test,status\nsearch,typos,pass", "table", "csv"},
		{"", "tests.tsv", "a\tb\n1\t2", "table", "tsv"},
		{"", "rows.json", `[{"a": 1}]`, "table", "json"},
		{"", "map.mmd", "graph LR\n a --> b", "diagram", "mermaid"},
		{"", "plan.md", "# Plan\n1. Index", "notes", "markdown"},
		{"", "reindex.html", "<!doctype html><p>hi</p>", "page", "html"},
		{"table", "out.txt", "a,b\n1,2", "table", "csv"},
		{"notes", "out.txt", "hello", "notes", "markdown"},
		{"diagram", "x", "graph TD\n a-->b", "diagram", "mermaid"},
	}
	for _, c := range cases {
		k, f, err := classifyArtifact(c.kind, c.name, []byte(c.body))
		if err != nil || k != c.wantKind || f != c.wantFormat {
			t.Errorf("%s (--kind %q) = %s/%s %v, want %s/%s", c.name, c.kind, k, f, err, c.wantKind, c.wantFormat)
		}
	}
	if _, _, err := classifyArtifact("", "out.bin", []byte("x")); err == nil || !strings.Contains(err.Error(), "can't tell") {
		t.Errorf("unknown file: %v", err)
	}
	if _, _, err := classifyArtifact("video", "a.mp4", []byte("x")); err == nil || !strings.Contains(err.Error(), "unknown kind") {
		t.Errorf("unknown kind: %v", err)
	}
}

func TestChartValidation(t *testing.T) {
	ok := []string{
		barChart,
		`{"$schema":"berth.chart/v1","type":"line","x":"day","y":["search"],"data":[{"day":"2026-10-01","search":1250},{"day":"2026-10-02","search":null}]}`,
		`{"$schema":"berth.chart/v1","type":"funnel","data":[{"label":"Visited","value":48200},{"label":"Bought","value":1900}]}`,
		`{"$schema":"berth.chart/v1","type":"pie","data":[{"label":"a","value":1}]}`,
		`{"$schema":"berth.chart/v1","type":"gauge","value":82,"max":100,"units":"%","label":"Hit rate"}`,
		`{"$schema":"berth.chart/v1","type":"sankey","nodes":[{"name":"Edge"},{"name":"API"},{"name":"200 OK","color":"good"}],"links":[{"source":"Edge","target":"API","value":5},{"source":"API","target":"200 OK","value":5}]}`,
		`{"$schema":"berth.chart/v1","type":"heatmap","x":"hour","row":"endpoint","z":"p95","data":[{"endpoint":"/search","hour":"08","p95":980}]}`,
	}
	for _, s := range ok {
		if err := ValidateChart([]byte(s)); err != nil {
			t.Errorf("valid chart refused: %v\n%s", err, s)
		}
	}
	bad := []struct{ spec, want string }{
		{`{"$schema":"berth.chart/v1","type":"bar"`, "doesn't parse"},
		{`{"$schema":"berth.chart/v2","type":"bar"}`, `"$schema" must be "berth.chart/v1"`},
		{`{"$schema":"berth.chart/v1","type":"scatter"}`, "type must be one of"},
		{`{"$schema":"berth.chart/v1","type":"bar","x":"e","y":["a"],"data":[{"e":"/s","a":"fast"}]}`, `data[0].a is "fast", not a number`},
		{`{"$schema":"berth.chart/v1","type":"bar","x":"e","y":["a"],"data":[{"e":"/s"}]}`, `data[0] has no "a"`},
		{`{"$schema":"berth.chart/v1","type":"bar","y":["a"],"data":[{"a":1}]}`, `needs "x"`},
		{`{"$schema":"berth.chart/v1","type":"bar","x":"e","y":[{"key":"a","color":"#ff0000"}],"data":[{"e":"x","a":1}]}`, "never hex"},
		{`{"$schema":"berth.chart/v1","type":"bar","x":"e","ys":["a"],"data":[{"e":"x","a":1}]}`, `"ys" isn't a berth.chart/v1 field`},
		{`{"$schema":"berth.chart/v1","type":"gauge","value":140}`, "outside 0–100"},
		{`{"$schema":"berth.chart/v1","type":"sankey","nodes":[{"name":"a"},{"name":"b"}],"links":[{"source":"a","target":"b","value":1},{"source":"b","target":"a","value":1}]}`, "loop back"},
		{`{"$schema":"berth.chart/v1","type":"sankey","nodes":[{"name":"a"}],"links":[{"source":"a","target":"z","value":1}]}`, `target "z" isn't a node's name`},
		{`{"$schema":"berth.chart/v1","type":"heatmap","x":"h","data":[]}`, `needs "x" (the column key), "row"`},
	}
	for _, b := range bad {
		err := ValidateChart([]byte(b.spec))
		if err == nil || !strings.Contains(err.Error(), b.want) {
			t.Errorf("%s\n  = %v, want %q", b.spec, err, b.want)
		}
	}
}

func TestArtifactSizeAndSecretRefusal(t *testing.T) {
	s, _ := newArtifactStore(t)
	big := "a,b\n" + strings.Repeat("1,2\n", (maxDataArtifact/4)+10)
	_, _, err := s.Add("shop", "wt", "/w", ArtifactInput{Title: "big", Name: "big.csv", Content: []byte(big)})
	var he httpError
	if err == nil || !strings.Contains(err.Error(), "may be 1024 KB") || !asHTTP(err, &he) || he.status != 413 {
		t.Fatalf("1 MB table: %v", err)
	}
	page := "<!doctype html><p>" + strings.Repeat("x", maxDataArtifact+100) + "</p>"
	if _, _, err := s.Add("shop", "wt", "/w", ArtifactInput{Title: "page", Name: "p.html", Content: []byte(page)}); err != nil {
		t.Fatalf("a page may be up to 2 MB: %v", err)
	}
	if _, _, err := s.Add("shop", "wt", "/w", ArtifactInput{Title: "bin", Name: "x.csv", Content: []byte("a,b\n\x00\x01")}); err == nil || !strings.Contains(err.Error(), "UTF-8") {
		t.Fatalf("binary: %v", err)
	}
	secrets := map[string]string{
		"a private key":                  "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----",
		"an AWS access key":              "key,value\naws,AKIAIOSFODNN7EXAMPLE",
		"a GitHub token":                 "# Notes\nuse ghp_abcdefghijklmnopqrstuvwxyz0123456789AB",
		"an Anthropic or OpenAI key":     "token: sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
		"a secret in an .env-style line": "# env\nSTRIPE_SECRET_KEY=abcd1234efgh5678ijkl\n",
		"a password in a URL":            "graph LR\n a[postgres://acme:hunter2hunter2@db.acme.test/shop] --> b",
		"a JSON web token":               "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
	}
	for what, body := range secrets {
		_, _, err := s.Add("shop", "wt", "/w", ArtifactInput{Title: "x", Name: "x.md", Content: []byte(body)})
		if err == nil || !strings.Contains(err.Error(), "looks like it holds a secret ("+what+")") {
			t.Errorf("%s: %v", what, err)
		}
	}
	// Ordinary data with numbers and ids is fine.
	if _, _, err := s.Add("shop", "wt", "/w", ArtifactInput{Title: "ok", Name: "ok.csv", Content: []byte("sku,token_count,status\nacme-kettle-2l,1240,pass\n")}); err != nil {
		t.Fatalf("ordinary table refused: %v", err)
	}
}

func TestArtifactWatchTakesARewriteAsAVersion(t *testing.T) {
	s, bus := newArtifactStore(t)
	evs, stop := bus.Subscribe()
	defer stop()
	clock := time.Now()
	s.Now = func() time.Time { return clock }
	wt := t.TempDir()
	src := filepath.Join(wt, "perf", "p95.json")
	os.MkdirAll(filepath.Dir(src), 0o755)
	os.WriteFile(src, []byte(barChart), 0o644)
	a, _, err := s.Add("shop", "search-perf", wt, ArtifactInput{Title: "p95", Name: "p95.json", Source: src, Watch: true, Content: []byte(barChart)})
	if err != nil {
		t.Fatal(err)
	}
	if a.File != "perf/p95.json" || !a.Watched {
		t.Fatalf("source not recorded: %+v", a)
	}
	// The agent rewrites it; nothing is taken until it holds still.
	v2 := strings.Replace(barChart, "410", "180", 1)
	writeLater(t, src, v2)
	s.Poll()
	clock = clock.Add(100 * time.Millisecond)
	s.Poll()
	if got, _ := s.Get(a.ID, wt); got.Latest().N != 1 {
		t.Fatalf("taken before it settled: v%d", got.Latest().N)
	}
	clock = clock.Add(artifactSettle)
	s.Poll()
	got, _ := s.Get(a.ID, wt)
	if got.Latest().N != 2 {
		t.Fatalf("rewrite not taken: v%d", got.Latest().N)
	}
	if _, _, body, _ := s.Content(a.ID, wt, 2); string(body) != v2 {
		t.Fatalf("v2 = %s", body)
	}
	e := waitEventType(t, evs, "artifact.updated")
	if e.Data["id"] != a.ID || e.Data["version"] != 2 || e.Origin != "watch" {
		t.Fatalf("event %+v", e)
	}
	// Half-written JSON is a problem, not a version.
	writeLater(t, src, `{"$schema": "berth.chart/v1", "type": "bar", "data": [`)
	s.Poll()
	clock = clock.Add(artifactSettle + time.Millisecond)
	s.Poll()
	got, _ = s.Get(a.ID, wt)
	if got.Latest().N != 2 || !strings.Contains(got.Problem, "doesn't parse") {
		t.Fatalf("bad rewrite: v%d problem %q", got.Latest().N, got.Problem)
	}
	// The next good one clears it.
	writeLater(t, src, strings.Replace(barChart, "410", "150", 1))
	s.Poll()
	clock = clock.Add(artifactSettle + time.Millisecond)
	s.Poll()
	got, _ = s.Get(a.ID, wt)
	if got.Latest().N != 3 || got.Problem != "" {
		t.Fatalf("after a good rewrite: v%d problem %q", got.Latest().N, got.Problem)
	}
}

// writeLater rewrites path so its modification time surely differs.
func writeLater(t *testing.T, path, body string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	fi, _ := os.Stat(path)
	later := fi.ModTime().Add(time.Second)
	os.Chtimes(path, later, later)
}

func waitEventType(t *testing.T, ch <-chan events.Event, typ string) events.Event {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		select {
		case e := <-ch:
			if e.Type == typ {
				return e
			}
		case <-deadline:
			t.Fatalf("no %s event", typ)
		}
	}
}

// localBox serves bx's routes on a unix socket, as berthd does for the
// box's own user (and its agents).
func localBox(t *testing.T, bx *Box) *Client {
	t.Helper()
	dir, err := os.MkdirTemp("/tmp", "bart")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	sock := filepath.Join(dir, "berthd.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	srv := &wire.Server{}
	bx.Mount(srv)
	ctx, stop := context.WithCancel(context.Background())
	t.Cleanup(stop)
	go srv.ServeLocal(ctx, ln)
	return NewClient(NewLocal(sock))
}

func TestArtifactRoutes(t *testing.T) {
	repo := gitRepo(t)
	ctx := context.Background()
	bus := &events.Bus{Sequence: true}
	bx := &Box{Name: "devbox", Locations: NewLocations(filepath.Join(t.TempDir(), "locations.json")), Events: bus}
	bx.Artifacts = &ArtifactStore{Dir: t.TempDir(), Events: bus, Box: "devbox"}
	if _, err := bx.Locations.Add(ctx, "shop", repo); err != nil {
		t.Fatal(err)
	}
	loc, _ := bx.Locations.Get(ctx, "shop")
	wt := loc.Worktrees[0]
	c := localBox(t, bx)
	evs, stop := bus.Subscribe()
	defer stop()
	base := "/v1/locations/shop/worktrees/" + wt.Name + "/artifacts"

	// Capability.
	if !contains(bx.Capabilities(), "artifacts") {
		t.Fatal("no artifacts capability")
	}

	src := filepath.Join(wt.Path, "p95.json")
	os.WriteFile(src, []byte(barChart), 0o644)
	var res AddArtifactResult
	if err := c.Call(ctx, "POST", base, addArtifactRequest{Title: "p95", Name: "p95.json", Source: src, Content: barChart, Session: "search-perf-claude", Helper: "Explore: map search"}, &res); err != nil {
		t.Fatal(err)
	}
	if !res.Added || !res.Changed || res.Artifact.File != "p95.json" || !res.Artifact.Watched || res.Artifact.By.Helper != "Explore: map search" {
		t.Fatalf("add = %+v", res)
	}
	id := res.Artifact.ID
	if e := waitEventType(t, evs, "artifact.added"); e.Data["id"] != id || e.Data["path"] != wt.Path {
		t.Fatalf("event %+v", e)
	}
	// Adding the same file again is that artifact, not a second one.
	var again AddArtifactResult
	if err := c.Call(ctx, "POST", base, addArtifactRequest{Title: "p95 again", Name: "p95.json", Source: src, Content: strings.Replace(barChart, "410", "300", 1), Note: "with the cache"}, &again); err != nil {
		t.Fatal(err)
	}
	if again.Added || again.Artifact.ID != id || again.Artifact.Latest().N != 2 || again.Artifact.Latest().Note != "with the cache" {
		t.Fatalf("re-add = %+v", again)
	}
	waitEventType(t, evs, "artifact.updated")

	var list []Artifact
	if err := c.Call(ctx, "GET", base, nil, &list); err != nil || len(list) != 1 || list[0].ID != id {
		t.Fatalf("list = %+v %v", list, err)
	}
	var one Artifact
	if err := c.Call(ctx, "GET", base+"/"+id, nil, &one); err != nil || len(one.Versions) != 2 {
		t.Fatalf("show = %+v %v", one, err)
	}
	// Content: by worktree and version, and by id alone (the art origin).
	for _, path := range []string{base + "/" + id + "/v/1", "/v1/artifacts/" + id + "/v/latest"} {
		resp, err := c.Doer.DoWithHeader(ctx, "GET", path, nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "text/plain; charset=utf-8" || resp.Header.Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(resp.Header.Get("Content-Security-Policy"), "sandbox") || resp.Header.Get("X-Burf-Artifact-Kind") != "chart" {
			t.Fatalf("%s: %d %v", path, resp.StatusCode, resp.Header)
		}
		if strings.HasSuffix(path, "/v/1") != (string(body) == barChart) {
			t.Fatalf("%s served the wrong version", path)
		}
	}
	// Refusals come back as words the agent can act on.
	err := c.Call(ctx, "POST", base, addArtifactRequest{Title: "bad", Name: "bad.json", Content: `{"$schema":"berth.chart/v1","type":"bar","x":"e","y":["a"],"data":[{"e":"/s","a":"fast"}]}`}, nil)
	if err == nil || !strings.Contains(err.Error(), `data[0].a is "fast", not a number`) {
		t.Fatalf("bad chart: %v", err)
	}
	err = c.Call(ctx, "POST", base, addArtifactRequest{Title: "env", Name: "env.md", Content: "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789AB"}, nil)
	if err == nil || !strings.Contains(err.Error(), "secret") {
		t.Fatalf("secret: %v", err)
	}
	if err := c.Call(ctx, "GET", "/v1/locations/shop/worktrees/"+wt.Name+"/artifacts/0123456789", nil, nil); err == nil || !strings.Contains(err.Error(), "no such artifact") {
		t.Fatalf("unknown id: %v", err)
	}
	// Removing it.
	if err := c.Call(ctx, "DELETE", base+"/"+id, nil, nil); err != nil {
		t.Fatal(err)
	}
	waitEventType(t, evs, "artifact.removed")
	if err := c.Call(ctx, "GET", base, nil, &list); err != nil || len(list) != 0 {
		t.Fatalf("after rm: %+v", list)
	}
	// The art- prefix is the proxy's.
	if _, err := bx.Locations.Add(ctx, "art-0123456789", repo); err == nil || !strings.Contains(err.Error(), "keeps those for artifacts") {
		t.Fatalf("art- location: %v", err)
	}
}

func TestArtifactRemoteAddIsNotWatched(t *testing.T) {
	repo := gitRepo(t)
	var bx *Box
	c, _ := servedBox(t, func(b *Box) {
		b.Artifacts = &ArtifactStore{Dir: t.TempDir(), Box: "devbox"}
		bx = b
	})
	if _, err := bx.Locations.Add(context.Background(), "shop", repo); err != nil {
		t.Fatal(err)
	}
	loc, _ := bx.Locations.Get(context.Background(), "shop")
	var res AddArtifactResult
	// From a laptop the path is the laptop's: not remembered, not watched.
	if st := call(t, c, "POST", "/v1/locations/shop/worktrees/"+loc.Worktrees[0].Name+"/artifacts", "", addArtifactRequest{Title: "t", Name: "t.csv", Source: "/etc/passwd", Content: "a,b\n1,2"}, &res); st != http.StatusOK {
		t.Fatalf("status %d", st)
	}
	if res.Artifact.Watched || res.Artifact.Source != "" {
		t.Fatalf("remote add watched %+v", res.Artifact)
	}
	var raw json.RawMessage
	if st := call(t, c, "GET", "/v1/artifacts/"+res.Artifact.ID+"/v/1", "", nil, &raw); st != http.StatusOK {
		t.Fatalf("content over the wire: %d", st)
	}
}

func asHTTP(err error, he *httpError) bool {
	h, ok := err.(httpError)
	if ok {
		*he = h
	}
	return ok
}

func equalInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
