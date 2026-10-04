package transcript

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func write(t *testing.T, path string, lines ...any) {
	t.Helper()
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	for _, l := range lines {
		b, _ := json.Marshal(l)
		f.Write(append(b, '\n'))
	}
}

type m = map[string]any

func user(content any) m {
	return m{"type": "user", "timestamp": "2026-10-04T12:00:00Z", "message": m{"role": "user", "content": content}}
}
func assistant(blocks ...m) m {
	return m{"type": "assistant", "timestamp": "2026-10-04T12:00:01Z", "message": m{"role": "assistant", "content": blocks}}
}
func tool(id, name string, input m) m { return m{"type": "tool_use", "id": id, "name": name, "input": input} }
func result(id string) m {
	return user([]m{{"type": "tool_result", "tool_use_id": id, "content": "secret output"}})
}

func kinds(items []Item) string {
	var k []string
	for _, it := range items {
		k = append(k, it.Kind)
	}
	return strings.Join(k, ",")
}

func TestClaudeTurn(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "s.jsonl")
	write(t, p,
		m{"type": "mode", "mode": "x"},
		user("Make webhook retries safe"),
		user("<command-name>/clear</command-name>"),
		assistant(m{"type": "thinking", "thinking": "private"}, m{"type": "text", "text": "I'll trace the webhook."}),
		assistant(tool("r1", "Read", m{"file_path": "/w/shop/apps/web/webhook.ts"})),
		assistant(tool("r2", "Read", m{"file_path": "/w/shop/apps/web/order.ts"})),
		result("r1"),
	)
	r := NewReader()
	res, err := r.Read("claude", p, "/w/shop", 0)
	if err != nil {
		t.Fatal(err)
	}
	if got := kinds(res.Items); got != "user,text,tools" {
		t.Fatalf("kinds = %s", got)
	}
	g := res.Items[2]
	if g.Done || len(g.Items) != 2 || g.Items[0].Target != "webhook.ts" || !g.Items[0].File {
		t.Fatalf("open group = %+v", g)
	}
	for _, it := range res.Items {
		if strings.Contains(it.Text, "private") || strings.Contains(it.Text, "secret") {
			t.Fatalf("thinking or tool output leaked: %+v", it)
		}
	}

	// The file grows: the open group comes again, now done, then the rest.
	write(t, p,
		result("r2"),
		assistant(tool("a1", "Agent", m{"description": "Explore retry paths", "subagent_type": "Explore"})),
		assistant(tool("e1", "Edit", m{"file_path": "/w/shop/apps/web/webhook.ts", "old_string": "a\nb", "new_string": "a\nb\nc\nd"})),
		assistant(tool("b1", "Bash", m{"command": "pnpm test payments\necho done"})),
		result("a1"),
		result("b1"),
		assistant(m{"type": "text", "text": "Done."}),
	)
	res2, err := r.Read("claude", p, "/w/shop", res.Next)
	if err != nil {
		t.Fatal(err)
	}
	if got := kinds(res2.Items); got != "tools,crew,edit,tools,text" {
		t.Fatalf("kinds after growth = %s", got)
	}
	if !res2.Items[0].Done || res2.Items[0].ID != g.ID {
		t.Fatalf("the open group should come again, done, with its ID: %+v", res2.Items[0])
	}
	e := res2.Items[2]
	if e.File != "apps/web/webhook.ts" || e.Added != 4 || e.Removed != 2 {
		t.Fatalf("edit = %+v", e)
	}
	if run := res2.Items[3]; run.Items[0].Target != "pnpm test payments …" || !run.Done {
		t.Fatalf("run = %+v", run)
	}
	if len(res2.Crew) != 1 || res2.Crew[0].State != "finished" || res2.Crew[0].Name != "Explore retry paths" {
		t.Fatalf("crew = %+v", res2.Crew)
	}

	// Nothing new: nothing sent.
	res3, _ := r.Read("claude", p, "/w/shop", res2.Next)
	if len(res3.Items) != 0 || res3.Next != res2.Next {
		t.Fatalf("idle read = %+v", res3)
	}
}

func TestPartialLineWaits(t *testing.T) {
	p := filepath.Join(t.TempDir(), "s.jsonl")
	b, _ := json.Marshal(user("hello there"))
	os.WriteFile(p, b[:10], 0o600) // half a line
	r := NewReader()
	res, _ := r.Read("claude", p, "", 0)
	if len(res.Items) != 0 {
		t.Fatalf("half a line parsed: %+v", res.Items)
	}
	f, _ := os.OpenFile(p, os.O_APPEND|os.O_WRONLY, 0)
	f.Write(append(b[10:], '\n'))
	f.Close()
	res, _ = r.Read("claude", p, "", 0)
	if kinds(res.Items) != "user" || res.Items[0].Text != "hello there" {
		t.Fatalf("after the rest = %+v", res.Items)
	}
}

func TestKeepsOnlyTheEnd(t *testing.T) {
	p := filepath.Join(t.TempDir(), "s.jsonl")
	var lines []any
	for i := 0; i < keep+50; i++ {
		lines = append(lines, assistant(m{"type": "text", "text": "line"}))
	}
	write(t, p, lines...)
	res, _ := NewReader().Read("claude", p, "", 0)
	if len(res.Items) != keep || res.Next != keep+50 || !res.Truncated {
		t.Fatalf("items %d next %d truncated %v", len(res.Items), res.Next, res.Truncated)
	}
}

func TestCodex(t *testing.T) {
	p := filepath.Join(t.TempDir(), "rollout.jsonl")
	ri := func(payload m) m { return m{"type": "response_item", "timestamp": "2026-10-04T12:00:00Z", "payload": payload} }
	args := func(v any) string { b, _ := json.Marshal(v); return string(b) }
	write(t, p,
		m{"type": "session_meta", "payload": m{"cwd": "/w/shop"}},
		ri(m{"type": "message", "role": "user", "content": []m{{"type": "input_text", "text": "<environment_context>x</environment_context>"}}}),
		ri(m{"type": "message", "role": "user", "content": []m{{"type": "input_text", "text": "Export orders as CSV"}}}),
		ri(m{"type": "function_call", "name": "shell", "call_id": "c1", "arguments": args(m{"command": []string{"bash", "-lc", "sed -n 1,80p apps/web/orders.ts"}})}),
		ri(m{"type": "function_call_output", "call_id": "c1", "output": "secret"}),
		ri(m{"type": "function_call", "name": "shell", "call_id": "c2", "arguments": args(m{"command": []string{"apply_patch", "*** Begin Patch\n*** Update File: apps/web/orders.ts\n@@\n-old\n+new\n+more\n*** End Patch"}})}),
		ri(m{"type": "function_call", "name": "shell", "call_id": "c3", "arguments": args(m{"command": []string{"bash", "-lc", "pnpm test"}})}),
		ri(m{"type": "message", "role": "assistant", "content": []m{{"type": "output_text", "text": "Added the export."}}}),
	)
	res, err := NewReader().Read("codex", p, "/w/shop", 0)
	if err != nil {
		t.Fatal(err)
	}
	if got := kinds(res.Items); got != "user,tools,edit,tools,text" {
		t.Fatalf("kinds = %s", got)
	}
	if r := res.Items[1].Items[0]; r.Verb != "Read" || r.Target != "orders.ts" {
		t.Fatalf("read = %+v", r)
	}
	if e := res.Items[2]; e.File != "apps/web/orders.ts" || e.Added != 2 || e.Removed != 1 {
		t.Fatalf("edit = %+v", e)
	}
	if cwd := codexCwd(p); cwd != "/w/shop" {
		t.Fatalf("cwd = %q", cwd)
	}
}

func TestLongLineIsSkipped(t *testing.T) {
	p := filepath.Join(t.TempDir(), "s.jsonl")
	write(t, p, user(strings.Repeat("x", maxLine+10)), user("after"))
	res, _ := NewReader().Read("claude", p, "", 0)
	if kinds(res.Items) != "user" || res.Items[0].Text != "after" {
		t.Fatalf("items = %+v", kinds(res.Items))
	}
}
