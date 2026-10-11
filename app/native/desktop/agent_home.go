//go:build !dev || !wailsfeedback || production

package desktop

func agentConnectionHome(home string) (string, error) { return home, nil }
