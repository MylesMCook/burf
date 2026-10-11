//go:build dev && !production

package desktop

import "os"

func feedbackFrontendURL() string { return os.Getenv("FRONTEND_DEVSERVER_URL") }
