package agent

import (
	"debug/buildinfo"
	"time"
)

// Tests supply metadata for their executable stand-ins.
var localBuildInfo = buildinfo.ReadFile

type developmentBuild struct {
	revision  string
	committed time.Time
}

// developmentBuildAt reads source chronology without executing the binary.
// Go records the base commit's time, not when a dirty checkout was built,
// so modified or unstamped binaries cannot be ordered safely.
func developmentBuildAt(path string) (developmentBuild, bool) {
	info, err := localBuildInfo(path)
	if err != nil || info == nil {
		return developmentBuild{}, false
	}
	var revision, committed, vcs, modified string
	for _, setting := range info.Settings {
		switch setting.Key {
		case "vcs":
			vcs = setting.Value
		case "vcs.revision":
			revision = setting.Value
		case "vcs.time":
			committed = setting.Value
		case "vcs.modified":
			modified = setting.Value
		}
	}
	when, err := time.Parse(time.RFC3339, committed)
	if vcs != "git" || revision == "" || modified != "false" || err != nil || when.IsZero() {
		return developmentBuild{}, false
	}
	return developmentBuild{revision: revision, committed: when}, true
}

func newerDevelopmentBuild(next, have string) bool {
	n, okNext := developmentBuildAt(next)
	h, okHave := developmentBuildAt(have)
	return okNext && okHave && n.revision != h.revision && n.committed.After(h.committed)
}
