package agent

import (
	"errors"
	"runtime/debug"
	"testing"
)

func localTestBuildInfo(revision, committed, modified string) *debug.BuildInfo {
	return &debug.BuildInfo{Settings: []debug.BuildSetting{
		{Key: "vcs", Value: "git"},
		{Key: "vcs.revision", Value: revision},
		{Key: "vcs.time", Value: committed},
		{Key: "vcs.modified", Value: modified},
	}}
}

func TestDevelopmentBuildOrderingRequiresKnownCleanSourceChronology(t *testing.T) {
	oldBuildInfo := localBuildInfo
	t.Cleanup(func() { localBuildInfo = oldBuildInfo })
	const earlier = "2026-10-09T10:00:00Z"
	const later = "2026-10-10T10:00:00Z"
	for _, tc := range []struct {
		name       string
		next, have *debug.BuildInfo
		want       bool
	}{
		{"newer clean commit", localTestBuildInfo("new", later, "false"), localTestBuildInfo("old", earlier, "false"), true},
		{"stale bundle", localTestBuildInfo("old", earlier, "false"), localTestBuildInfo("new", later, "false"), false},
		{"same commit rebuilt", localTestBuildInfo("same", later, "false"), localTestBuildInfo("same", earlier, "false"), false},
		{"equal commit times", localTestBuildInfo("new", later, "false"), localTestBuildInfo("old", later, "false"), false},
		{"dirty candidate", localTestBuildInfo("new", later, "true"), localTestBuildInfo("old", earlier, "false"), false},
		{"dirty installed daemon", localTestBuildInfo("new", later, "false"), localTestBuildInfo("old", earlier, "true"), false},
		{"legacy candidate has no metadata", nil, localTestBuildInfo("old", earlier, "false"), false},
		{"legacy installed daemon has no metadata", localTestBuildInfo("new", later, "false"), nil, false},
		{"malformed time", localTestBuildInfo("new", "yesterday", "false"), localTestBuildInfo("old", earlier, "false"), false},
		{"missing revision", localTestBuildInfo("", later, "false"), localTestBuildInfo("old", earlier, "false"), false},
		{"missing modified marker", localTestBuildInfo("new", later, ""), localTestBuildInfo("old", earlier, "false"), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			localBuildInfo = func(path string) (*debug.BuildInfo, error) {
				info := tc.have
				if path == "next" {
					info = tc.next
				}
				if info == nil {
					return nil, errors.New("no build info")
				}
				return info, nil
			}
			if got := newerDevelopmentBuild("next", "have"); got != tc.want {
				t.Fatalf("newer development build = %v, want %v", got, tc.want)
			}
		})
	}
}
