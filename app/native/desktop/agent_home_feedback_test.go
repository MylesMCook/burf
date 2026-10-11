//go:build dev && wailsfeedback && !production

package desktop

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestFeedbackCLIUsesSameAgentHome(t *testing.T) {
	if err := ordinaryUser(); err != nil {
		t.Skip("CLI process verification requires an ordinary user token")
	}
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	agentHome := t.TempDir()
	t.Setenv("BERTH_CLI", executable)
	t.Setenv("BERTH_HOME", t.TempDir())
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("WAILS_FEEDBACK_AGENT_HOME", agentHome)
	t.Setenv("BURF_FEEDBACK_TEST_HELPER", "1")
	actual, err := runCLI(context.Background(), "-test.run=^TestFeedbackCLIHelperProcess$")
	if err != nil || actual != agentHome {
		t.Fatalf("CLI did not receive the selected agent home: %v", err)
	}
}

func TestFeedbackCLIHelperProcess(t *testing.T) {
	if os.Getenv("BURF_FEEDBACK_TEST_HELPER") != "1" {
		return
	}
	fmt.Print(os.Getenv("BERTH_HOME"))
	os.Exit(0)
}

func TestFeedbackConnectsExistingAgentWithoutSharingBrowserState(t *testing.T) {
	agentHome, profile := t.TempDir(), t.TempDir()
	if err := os.MkdirAll(filepath.Join(agentHome, "client"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(agentHome, "client", "ui-token"), []byte("synthetic-existing-agent-token"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("WAILS_FEEDBACK_AGENT_HOME", agentHome)
	service := New(Config{StateHome: profile})
	endpoint, err := service.endpoint()
	if err != nil {
		t.Fatal(err)
	}
	if endpoint.Token != "synthetic-existing-agent-token" || endpoint.URL != "http://127.0.0.1:1378" {
		t.Fatal("Feedback did not use the existing authenticated agent")
	}
	if service.config.StateHome != profile {
		t.Fatal("Browser profile stopped being isolated")
	}
	if _, err := os.Stat(filepath.Join(profile, "client", "ui-token")); !os.IsNotExist(err) {
		t.Fatal("Agent token was copied into the development profile")
	}
}

func TestFeedbackAgentHomeBoundaries(t *testing.T) {
	profile := t.TempDir()
	t.Setenv("WAILS_FEEDBACK", "0")
	t.Setenv("WAILS_FEEDBACK_AGENT_HOME", "relative")
	actual, err := agentConnectionHome(profile)
	if err != nil || actual != profile {
		t.Fatal("feedback-off launch changed the agent home")
	}
	t.Setenv("WAILS_FEEDBACK", "1")
	if _, err := agentConnectionHome(profile); err == nil {
		t.Fatal("relative agent home accepted")
	}
	t.Setenv("WAILS_FEEDBACK_AGENT_HOME", "")
	base, err := os.UserConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	actual, err = agentConnectionHome(profile)
	if err != nil || actual != filepath.Join(base, "berth") {
		t.Fatal("feedback did not discover the standard agent state")
	}
}

func TestFeedbackDirectorySharesOriginalAgentHomeOnly(t *testing.T) {
	profile, home := t.TempDir(), t.TempDir()
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("WAILS_FEEDBACK_AGENT_HOME", home)
	actual, err := FeedbackDirectory(profile)
	if err != nil || actual != filepath.Join(home, "client", "native-feedback") {
		t.Fatal("development feedback discovery was redirected into the isolated browser profile")
	}
	t.Setenv("WAILS_FEEDBACK", "0")
	actual, err = FeedbackDirectory(profile)
	if err != nil || actual != filepath.Join(profile, "client", "native-feedback") {
		t.Fatal("feedback-off launch changed the original profile")
	}
}
