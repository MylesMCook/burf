package boxcmd

import (
	"os"

	"github.com/MylesMCook/burf/internal/box"
)

// reportBack is c making a call that starts work for the agent session
// this command runs in (BERTH_SESSION), so the box tells that agent when
// the work ends. Not for --no-notify, nor for commands a hook or flow runs
// (BERTH_ORIGIN): those have no one waiting.
func reportBack(c *box.Client, off bool) *box.Client {
	if off || os.Getenv("BERTH_ORIGIN") != "" {
		return c
	}
	return c.WithCaller(os.Getenv("BERTH_SESSION"))
}
