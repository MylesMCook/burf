package desktop

import (
	"errors"
	"net/url"
	"path/filepath"
	"runtime"
	"strconv"
)

// FeedbackDirectory shares only feedback state with the registered client.
// A development WebView profile must not redirect the existing agent's state.
func FeedbackDirectory(profile string) (string, error) {
	home, err := agentConnectionHome(profile)
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "client", "native-feedback"), nil
}

func FeedbackOrigin() (string, error) {
	origin := "wails://localhost"
	if runtime.GOOS == "windows" {
		origin = "http://wails.localhost"
	}
	raw := feedbackFrontendURL()
	if raw == "" {
		return origin, nil
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", errors.New("invalid feedback development origin")
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil || port < 1024 || port > 65535 || u.Scheme != "http" || u.Host != "127.0.0.1:"+strconv.Itoa(port) || u.User != nil || u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
		return "", errors.New("invalid feedback development origin")
	}
	return origin + ":" + strconv.Itoa(port), nil
}
