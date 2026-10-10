//go:build !windows

package agent

import "testing"

func uiStateTestDir(t *testing.T) string {
	t.Helper()
	return t.TempDir()
}
