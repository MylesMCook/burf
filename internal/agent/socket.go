package agent

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// SocketPath keeps long Windows state paths within the AF_UNIX limit.
// Ordinary paths and all Unix clients retain their existing socket location.
func SocketPath(dir string) string {
	path := filepath.Join(dir, "agent.sock")
	if runtime.GOOS != "windows" || len(path) <= 100 {
		return path
	}
	cache, err := os.UserCacheDir()
	if err != nil || !filepath.IsAbs(cache) {
		return path
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return path
	}
	hash := sha256.Sum256([]byte(strings.ToLower(filepath.Clean(abs))))
	return filepath.Join(cache, "berth-ipc", fmt.Sprintf("%x.sock", hash[:10]))
}
