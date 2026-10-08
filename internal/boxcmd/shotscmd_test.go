package boxcmd

import (
	"slices"
	"strings"
	"testing"
)

func TestShotsArgs(t *testing.T) {
	pos, l, err := shotsArgs([]string{"shop/search-perf", "--pages", "/", "/login", "--sizes", "375", "768,1280", "--base", "turn-start", "--mask", "time", "--color-scheme", "both", "--new"})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(pos, []string{"shop/search-perf"}) || !slices.Equal(l["pages"], []string{"/", "/login"}) || !slices.Equal(l["sizes"], []string{"375", "768", "1280"}) ||
		!slices.Equal(l["base"], []string{"turn-start"}) || !slices.Equal(l["mask"], []string{"time"}) || !slices.Equal(l["color-scheme"], []string{"both"}) || len(l["new"]) != 1 {
		t.Fatalf("pos %v lists %v", pos, l)
	}
	if _, _, err := shotsArgs([]string{"--nope"}); err == nil {
		t.Fatal("an unknown flag should fail")
	}
}

func TestShotsCompareCallsTheBox(t *testing.T) {
	r, out := run(t, `{"text":"visual diff vd-1 v1: …","artifact":"vd-1","version":1}`,
		"shots", "compare", "shop/search-perf", "--pages", "/", "/search", "--sizes", "375px,1280", "--mask", "time", "--mask", ".avatar", "--color-scheme", "dark", "--note", "first pass")
	if r.method != "POST" || r.path != "/v1/worktrees/shop/search-perf/shots/compare" {
		t.Fatalf("request %s %s", r.method, r.path)
	}
	if !slices.Equal(anyStrings(r.body["pages"]), []string{"/", "/search"}) || !slices.Equal(anyStrings(r.body["mask"]), []string{"time", ".avatar"}) ||
		r.body["color_scheme"] != "dark" || r.body["note"] != "first pass" || r.body["base"] != nil {
		t.Fatalf("body %v", r.body)
	}
	if sizes, _ := r.body["sizes"].([]any); len(sizes) != 2 || sizes[0] != float64(375) || sizes[1] != float64(1280) {
		t.Fatalf("sizes %v", r.body["sizes"])
	}
	if !strings.HasPrefix(out, "visual diff vd-1 v1") {
		t.Fatalf("out %q", out)
	}
}

func TestShotsBaselineAndAccept(t *testing.T) {
	r, _ := run(t, `{"text":"baseline saved"}`, "shots", "baseline", "shop/search-perf")
	if r.path != "/v1/worktrees/shop/search-perf/shots/compare" || r.body["save"] != "turn-start" {
		t.Fatalf("baseline: %s %v", r.path, r.body)
	}
	r, _ = run(t, `{"text":"baseline saved"}`, "shots", "baseline", "shop/search-perf", "--name", "before-refactor")
	if r.body["save"] != "before-refactor" {
		t.Fatalf("baseline --name: %v", r.body)
	}
	r, out := run(t, `{"text":"accepted vd-1 v2"}`, "shots", "accept", "shop/search-perf", "vd-1")
	if r.path != "/v1/worktrees/shop/search-perf/shots/accept" || r.body["artifact"] != "vd-1" || !strings.Contains(out, "accepted") {
		t.Fatalf("accept: %s %v %q", r.path, r.body, out)
	}
	t.Setenv("BERTH_LOCATION", "shop")
	t.Setenv("BERTH_WORKTREE_NAME", "search-perf")
	r, _ = run(t, `{"text":"ok"}`, "shots", "accept", "vd-2")
	if r.path != "/v1/worktrees/shop/search-perf/shots/accept" || r.body["artifact"] != "vd-2" {
		t.Fatalf("accept in a session: %s %v", r.path, r.body)
	}
}

func anyStrings(v any) []string {
	l, _ := v.([]any)
	var out []string
	for _, x := range l {
		s, _ := x.(string)
		out = append(out, s)
	}
	return out
}
