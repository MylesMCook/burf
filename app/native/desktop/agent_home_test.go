//go:build !dev || !wailsfeedback || production

package desktop

import (
	"path/filepath"
	"testing"
)

func TestReleaseIgnoresFeedbackAgentHome(t *testing.T) {
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("WAILS_FEEDBACK_AGENT_HOME", t.TempDir())
	home := t.TempDir()
	actual, err := agentConnectionHome(home)
	if err != nil || actual != home {
		t.Fatal("ordinary or production build accepted the feedback agent override")
	}
}

func TestRegularFeedbackDirectoryIgnoresInjectedAgentHome(t *testing.T) {
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("WAILS_FEEDBACK_AGENT_HOME", t.TempDir())
	profile := t.TempDir()
	actual, err := FeedbackDirectory(profile)
	if err != nil || actual != filepath.Join(profile, "client", "native-feedback") {
		t.Fatal("regular feedback accepted the development agent-home override")
	}
}
