package agent

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	box "github.com/MylesMCook/burf/internal/boxclient"
	"github.com/MylesMCook/burf/internal/wire"
)

// A box names itself (its hostname, or the name given at install), and a
// laptop pairs it under a name of its own: devl for a box that calls itself
// devbox. URLs made on the box, such as $BERTH_URL or an app's configured
// origin, carry the box's own name, so the proxy accepts that name too, as
// long as it is not also a paired box's name and only one box claims it.
// One box serves every laptop, each with its own name for it, so the
// laptop learns the box's name rather than the box learning each laptop's.

type selfNames struct {
	mu    sync.Mutex
	names map[string]string // paired name → the box's own name, lowercased
}

func (s *selfNames) set(paired, self string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.names == nil {
		s.names = map[string]string{}
	}
	s.names[paired] = strings.ToLower(self)
}

// learnSelfName asks a box that just came online what it calls itself.
func (a *Agent) learnSelfName(ctx context.Context, paired string, c *wire.Client) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var info box.Info
	if err := box.NewClient(c).Call(ctx, http.MethodGet, "/v1/info", nil, &info); err == nil && info.Name != "" {
		a.selfNames.set(paired, info.Name)
	}
}

// boxAlias is the paired box whose own name is name, when exactly one is.
func (a *Agent) boxAlias(name string) (string, bool) {
	name = strings.ToLower(name)
	if _, ok := a.client(name); ok {
		return "", false
	}
	a.selfNames.mu.Lock()
	var found []string
	for paired, self := range a.selfNames.names {
		if self == name && self != paired {
			found = append(found, paired)
		}
	}
	a.selfNames.mu.Unlock()
	if len(found) != 1 {
		return "", false
	}
	if _, ok := a.client(found[0]); !ok {
		return "", false
	}
	return found[0], true
}
