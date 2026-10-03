package main

import (
	"testing"

	"github.com/sean-brydon/berthd/internal/usagecheck"
)

// Every flag a command defines is in its usage error and in berthd help,
// and every flag the help offers exists.
func TestHelpMatchesFlags(t *testing.T) {
	cmds, err := usagecheck.Commands(".", usagecheck.Dir("internal/boxcmd"))
	if err != nil {
		t.Fatal(err)
	}
	if len(cmds) < 15 {
		t.Fatalf("found only %d commands with flags; is the scan still finding them?", len(cmds))
	}
	// Only the laptop can queue a prompt for a box it cannot reach.
	skip := map[string]bool{"session send --queue": true}
	for _, p := range usagecheck.Problems("berthd", helpText(), cmds, skip) {
		t.Error(p)
	}
}
