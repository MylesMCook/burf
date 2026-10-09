package agent

import "github.com/MylesMCook/burf/internal/events"

// Event types the agent publishes. Box events are relayed with their own.
const (
	EventAgentStarted    = "laptop.started"
	EventBoxConnected    = "box.connected"
	EventBoxDisconnected = "box.disconnected"
	EventBoxUntrusted    = "box.untrusted"
	// EventBoxLink: a box's link got slow or steady again, or Tailscale
	// started or stopped relaying it (link.go).
	EventBoxLink        = "box.link"
	EventForwardStarted = "forward.started"
	EventForwardFailed  = "forward.failed"
	EventForwardRemoved = "forward.removed"
)

type Event = events.Event

func forwardData(f Forward) map[string]any {
	return map[string]any{"id": f.ID, "local": f.Local, "remote": f.Remote}
}
