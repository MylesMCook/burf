package agent

import (
	"os"
	"strings"
)

// Keep this client's account settings while making the resolved CLI's runtime
// and tools available. Discovery supplies PATH only; no sign-in is copied.
func withLocalPATH(env []string, path string) []string {
	if path == "" {
		return env
	}
	if env == nil {
		env = os.Environ()
	}
	out := make([]string, 0, len(env)+1)
	for _, entry := range env {
		if !strings.HasPrefix(entry, "PATH=") {
			out = append(out, entry)
		}
	}
	return append(out, "PATH="+path)
}
