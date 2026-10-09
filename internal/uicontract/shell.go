// Package uicontract names the desktop command, event and capability contract.
package uicontract

import (
	_ "embed"
	"strings"
)

// Bump shell.txt whenever a native command's name or arguments, an event's
// payload, or a capability used by the frontend changes. Frontend-only changes
// that use the same native contract keep it. Rust and ui-manifest.mjs read this
// same file; it is not the app's release version.
//
//go:embed shell.txt
var shell string

func Shell() string { return strings.TrimSpace(shell) }
