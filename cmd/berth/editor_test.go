package main

import "testing"

func TestSplitPositionReadsLineAndColumn(t *testing.T) {
	for in, want := range map[string]struct {
		path      string
		line, col int
	}{
		"src/a.ts:12:3":          {"src/a.ts", 12, 3},
		"internal/box/api.go:42": {"internal/box/api.go", 42, 0},
		"README.md":              {"README.md", 0, 0},
		"weird:name.txt":         {"weird:name.txt", 0, 0},
	} {
		p, l, c := splitPosition(in)
		if p != want.path || l != want.line || c != want.col {
			t.Errorf("%s → %s %d %d", in, p, l, c)
		}
	}
}
