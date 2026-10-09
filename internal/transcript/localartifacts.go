package transcript

import (
	"regexp"
	"strconv"
	"strings"
)

// Local artifacts are the ones an agent registers on its box with
// `berthd artifact add` (box/artifacts.go), not pages on claude.ai. The
// command answers with a line of its own form (boxcmd.ArtifactLine):
//
//	Artifact 1a2b3c4d5e v1 · chart · p95 before and after
//
// and where that line comes back in a tool's result, the chat gets an
// artifact item there, with Local the artifact's id: the app shows it as
// a card with a live thumbnail. Only the id comes from the transcript;
// the app looks it up in the worktree's artifacts, so a forged line
// shows nothing that isn't there.
var localArtifactLine = regexp.MustCompile(`(?m)(?:^|\\n|"output":")Artifact ([0-9a-f]{10}) v([0-9]{1,6}) · ([a-z]{1,16}) · ([^\n\\"]{1,200})`)

// localArtifacts adds an item for each artifact a result says was added
// or updated.
func (c *conv) localArtifacts(toolID, text string) {
	if c.ignoreLocalArtifacts || !strings.Contains(text, "Artifact ") {
		return
	}
	for _, m := range localArtifactLine.FindAllStringSubmatch(text, 4) {
		n, _ := strconv.Atoi(m[2])
		title := strings.TrimSuffix(strings.TrimSpace(m[4]), " (no change)")
		c.add(Item{Kind: "artifact", ID: c.id(), Tool: toolID, Text: clip(title, 200), Local: m[1], Version: n, Updated: n > 1, Done: true})
	}
}
