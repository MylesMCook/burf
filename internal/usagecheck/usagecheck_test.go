package usagecheck

import (
	"reflect"
	"testing"
)

func TestLeadingWords(t *testing.T) {
	for in, want := range map[string]string{
		"usage: berth upgrade BOX [--check [--json]]":          "upgrade",
		"session send NAME TEXT [--no-enter]":                  "session send",
		"service list|start|stop|restart|log LOC/WORKTREE":     "service list|start|stop|restart|log",
		"usage: berthd secret exec [--socket PATH] -- PROGRAM": "secret exec",
		"preview [LOC/WORKTREE] [PORT] [--path /page]":         "preview",
	} {
		if got := leadingWords(in); got != want {
			t.Errorf("leadingWords(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEntries(t *testing.T) {
	help := `Section
  x one [--a]          Does one
  x two [--b] [--c]
        [--d]
                       Does two
  y other              Not x's
Next
  x three              Does three
`
	want := []string{
		"x one [--a]          Does one",
		"x two [--b] [--c]\n[--d]\nDoes two",
		"x three              Does three",
	}
	if got := Entries("x", help); !reflect.DeepEqual(got, want) {
		t.Errorf("Entries = %q\nwant %q", got, want)
	}
}

func TestProblems(t *testing.T) {
	cmds := []Command{
		{Name: "one", Flags: []string{"a", "json"}, Usages: []string{"usage: x one [--a]"}},
		{Name: "two", Flags: []string{"b", "c", "d"}, Usages: []string{"two [--b]"}},
		{Name: "", Flags: []string{"e"}},
	}
	help := "  x one [--a] [--z]   One\n  x two [--b] [--c]   Two\n"
	got := Problems("x", help, cmds, map[string]bool{"two --c": true})
	want := []string{
		": two defines --d, but its usage error leaves it out: \"two [--b]\"",
		": two defines --d, but x help leaves it out",
		": flags [e] belong to no command; give it a usage error naming the command",
		"x help offers --z for x one, which defines no such flag",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Problems =\n%q\nwant\n%q", got, want)
	}
}
