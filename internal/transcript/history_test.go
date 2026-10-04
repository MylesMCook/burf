package transcript

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// A long conversation: prompts each answered with a read and a reply.
func longChat(t *testing.T, p string, turns int) {
	t.Helper()
	for i := 0; i < turns; i++ {
		n := itoa(i)
		u := user("prompt " + n)
		u["uuid"], u["parentUuid"] = "u-"+n+"-0000", "p-"+n+"-0000"
		write(t, p,
			u,
			assistant(tool("r"+n, "Read", m{"file_path": "/w/f" + n + ".go"})),
			result("r"+n),
			assistant(m{"type": "text", "text": "reply " + n}),
		)
	}
}

func texts(items []Item) []string {
	var out []string
	for _, it := range items {
		switch it.Kind {
		case "user", "text":
			out = append(out, it.Text)
		case "tools":
			out = append(out, "tools:"+it.Items[0].Target)
		}
	}
	return out
}

func TestPagesReachTheStartWithoutRepeats(t *testing.T) {
	p := filepath.Join(t.TempDir(), "s.jsonl")
	longChat(t, p, 400) // 1200 items: 300 live, the rest in pages
	r := NewReader()
	live, err := r.Read("claude", p, "/w", 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(live.Items) != keep || !live.Truncated {
		t.Fatalf("live = %d items, truncated %v", len(live.Items), live.Truncated)
	}
	first := live.Items[0]
	if first.Off == 0 {
		t.Fatal("live items carry no offset")
	}
	all := texts(live.Items)
	seen := map[string]bool{}
	before, pages := first.Off, 0
	for {
		page, err := Before("claude", p, "/w", before, 250)
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Items) == 0 {
			t.Fatal("an empty page")
		}
		for _, it := range page.Items {
			if seen[it.ID] || it.Off >= before {
				t.Fatalf("item %+v repeats or is past %d", it, before)
			}
			seen[it.ID] = true
			if it.Kind == "tools" && !it.Done {
				t.Fatalf("an older group is still open: %+v", it)
			}
		}
		all = append(texts(page.Items), all...)
		before = page.Items[0].Off
		pages++
		if !page.More {
			break
		}
	}
	if len(all) != 1200 || all[0] != "prompt 0" || all[1] != "tools:f0.go" || all[1199] != "reply 399" {
		t.Fatalf("paged %d items in %d pages: first %v", len(all), pages, all[:3])
	}
	for i := 0; i < 400; i++ {
		if all[i*3] != "prompt "+itoa(i) {
			t.Fatalf("item %d = %q", i*3, all[i*3])
		}
	}
}

func TestPromptsCarryTheirEntry(t *testing.T) {
	p := filepath.Join(t.TempDir(), "s.jsonl")
	longChat(t, p, 2)
	res, _ := NewReader().Read("claude", p, "/w", 0)
	u := res.Items[3]
	if u.Kind != "user" || u.UUID != "u-1-0000" || u.Parent != "p-1-0000" || u.Off == 0 {
		t.Fatalf("prompt = %+v", u)
	}
}

func TestHelpersAreListedMatchedAndRead(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "sess.jsonl")
	at := time.Now().Add(-time.Hour)
	ts := func(d time.Duration) string { return at.Add(d).UTC().Format(time.RFC3339Nano) }
	call := assistant(tool("toolu_A", "Agent", m{"description": "Count src", "subagent_type": "Explore", "prompt": "Count the files in src"}))
	call["timestamp"] = ts(0)
	call2 := assistant(tool("toolu_B", "Task", m{"description": "Count docs", "prompt": "Count the files in docs"}))
	call2["timestamp"] = ts(time.Second)
	write(t, p, user("count files"), call, call2)

	sub := HelpersDir(p)
	if err := os.MkdirAll(sub, 0o700); err != nil {
		t.Fatal(err)
	}
	side := func(l m) m { l["isSidechain"] = true; return l }
	first := side(user("Count the files in src"))
	first["timestamp"] = ts(2 * time.Second)
	write(t, filepath.Join(sub, "agent-a1.jsonl"), first,
		side(assistant(tool("h1", "Bash", m{"command": "ls src | wc -l"}))),
		side(result("h1")),
		side(assistant(m{"type": "text", "text": "src has 12 files"})),
	)
	os.WriteFile(filepath.Join(sub, "agent-a1.meta.json"), []byte(`{"agentType":"Explore","description":"Count src","toolUseId":"toolu_A","spawnDepth":1}`), 0o600)
	// No toolUseId (a teammate): matched by name.
	second := side(user("Count the files in docs"))
	second["timestamp"] = ts(3 * time.Second)
	write(t, filepath.Join(sub, "agent-b2.jsonl"), second)
	os.WriteFile(filepath.Join(sub, "agent-b2.meta.json"), []byte(`{"agentType":"general-purpose","description":"Count docs"}`), 0o600)

	r := NewReader()
	main, _ := r.Read("claude", p, "/w", 0)
	hs := Helpers(p)
	MatchHelpers(hs, main.Crew, time.Now())
	if len(hs) != 2 || hs[0].ID != "a1" || hs[0].Tool != "toolu_A" || hs[0].Prompt != "Count the files in src" || hs[0].Name != "Count src" {
		t.Fatalf("helpers = %+v", hs)
	}
	if hs[1].Tool != "toolu_B" || hs[1].State != "running" {
		t.Fatalf("second = %+v (crew %+v)", hs[1], main.Crew)
	}
	hp, ok := HelperPath(p, "a1")
	if !ok {
		t.Fatal("no path for a1")
	}
	if _, ok := HelperPath(p, "../sess"); ok {
		t.Fatal("a path outside the helpers' folder")
	}
	res, err := r.Read("claude", hp, "/w", 0)
	if err != nil {
		t.Fatal(err)
	}
	if got := kinds(res.Items); got != "user,tools,text" {
		t.Fatalf("helper's chat = %s", got)
	}
	d, err := Detail("claude", hp, "/w", "h1")
	if err != nil || d.Command != "ls src | wc -l" {
		t.Fatalf("detail = %+v, %v", d, err)
	}
}

func TestForkCopiesUpToThePoint(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "0000aaaa-1111-2222-3333-444455556666.jsonl")
	e := func(uuid, parent, text string) m {
		l := user(text)
		l["uuid"], l["parentUuid"], l["sessionId"] = uuid, parent, "0000aaaa-1111-2222-3333-444455556666"
		return l
	}
	write(t, p, e("e1-0000000", "", "banana"), e("e2-0000000", "e1-0000000", "cherry"), e("e3-0000000", "e2-0000000", "damson"))
	id, err := ForkClaude(p, "e2-0000000")
	if err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(filepath.Join(dir, id+".jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	var got []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		var l struct {
			UUID      string `json:"uuid"`
			SessionID string `json:"sessionId"`
		}
		json.Unmarshal(sc.Bytes(), &l)
		if l.SessionID != id {
			t.Fatalf("line keeps the old session: %s", sc.Text())
		}
		got = append(got, l.UUID)
	}
	if strings.Join(got, ",") != "e1-0000000,e2-0000000" {
		t.Fatalf("copied %v", got)
	}
	if _, err := ForkClaude(p, "nowhere-000"); err != ErrNoEntry {
		t.Fatalf("missing point: %v", err)
	}
	if m, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(m) > 0 {
		t.Fatalf("left %v", m)
	}
}

// After /rewind, the next prompt picks up where the rewound one did: it
// and what followed it are gone from the conversation.
func TestRewindDropsTheRewoundTurn(t *testing.T) {
	p := filepath.Join(t.TempDir(), "s.jsonl")
	longChat(t, p, 3)
	r := NewReader()
	before, _ := r.Read("claude", p, "/w", 0)
	if len(before.Items) != 9 {
		t.Fatalf("items = %d", len(before.Items))
	}
	again := user("prompt 1, said differently")
	again["uuid"], again["parentUuid"] = "u-again-0000", "p-1-0000"
	write(t, p, again, assistant(m{"type": "text", "text": "a different reply"}))
	after, _ := r.Read("claude", p, "/w", 0)
	got := strings.Join(texts(after.Items), "|")
	if got != "prompt 0|tools:f0.go|reply 0|prompt 1, said differently|a different reply" {
		t.Fatalf("after rewind: %s", got)
	}
	if after.Next >= before.Next {
		t.Fatalf("next %d → %d: the app wouldn't read it afresh", before.Next, after.Next)
	}
}
