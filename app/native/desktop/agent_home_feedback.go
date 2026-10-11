//go:build dev && wailsfeedback && !production

package desktop

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Feedback keeps its browser profile separate while connecting to the user's
// existing agent. Read the token in place; never copy it into development state.
func agentConnectionHome(profile string) (string, error) {
	if os.Getenv("WAILS_FEEDBACK") != "1" {
		return profile, nil
	}
	if home := os.Getenv("WAILS_FEEDBACK_AGENT_HOME"); home != "" {
		if !filepath.IsAbs(home) {
			return "", errors.New("feedback agent home must be an absolute path")
		}
		return home, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("locate feedback agent configuration: %w", err)
	}
	return filepath.Join(base, "berth"), nil
}
