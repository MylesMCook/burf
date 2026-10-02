package agent

import "github.com/sean-brydon/berthd/internal/events"

// Event types the agent publishes. Box events are relayed with their own.
const (
	EventAgentStarted    = "laptop.started"
	EventBoxConnected    = "box.connected"
	EventBoxDisconnected = "box.disconnected"
	EventBoxUntrusted    = "box.untrusted"
	EventForwardStarted  = "forward.started"
	EventForwardFailed   = "forward.failed"
	EventForwardRemoved  = "forward.removed"
)

type Event = events.Event

func forwardData(f Forward) map[string]any {
	return map[string]any{"id": f.ID, "local": f.Local, "remote": f.Remote}
}
