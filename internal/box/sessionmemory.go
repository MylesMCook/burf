package box

import (
	"context"
	"fmt"
	"time"

	"github.com/cosscom/shipyard/internal/events"
)

// WatchSessionMemory says when a session nears its memory ceiling: once,
// as a session.memory event (the app shows it in the chat and the
// session's status) and a notification, and again only after it has gone
// well below. A session at its ceiling is slowed down, never killed.
func (b *Box) WatchSessionMemory(ctx context.Context) {
	if b.Sessions == nil || b.Sessions.Scopes == nil {
		return
	}
	t := time.NewTicker(15 * time.Second)
	defer t.Stop()
	near := map[string]bool{}
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b.checkSessionMemory(ctx, near)
		}
	}
}

func (b *Box) checkSessionMemory(ctx context.Context, near map[string]bool) {
	all, err := b.Sessions.list(ctx)
	if err != nil {
		return
	}
	seen := map[string]bool{}
	for _, s := range all {
		u, ok := b.Sessions.scopeUsage(ctx, s)
		if !ok || u.MemoryHigh == 0 {
			continue
		}
		key := s.Name + "\x00" + s.Scope
		seen[key] = true
		switch {
		case u.NearLimit && !near[key]:
			near[key] = true
			text := memoryNote(u)
			b.Events.Publish(events.Event{Type: "session.memory", Box: b.Name, Origin: "sessions", Data: map[string]any{
				"name": s.Name, "location": s.Location, "memory": u.Memory, "memory_high": u.MemoryHigh, "near_limit": true, "text": text}})
			b.Events.Publish(events.Event{Type: "notify", Box: b.Name, Origin: "sessions", Data: map[string]any{
				"title": sessionWhere(s) + " is near its memory limit", "body": text + ". It slows down at the limit; nothing is stopped.", "location": s.Location, "session": s.Name}})
		case near[key] && float64(u.Memory) < 0.8*float64(u.MemoryHigh):
			delete(near, key)
			b.Events.Publish(events.Event{Type: "session.memory", Box: b.Name, Origin: "sessions", Data: map[string]any{
				"name": s.Name, "location": s.Location, "memory": u.Memory, "memory_high": u.MemoryHigh, "near_limit": false}})
		}
	}
	for k := range near {
		if !seen[k] {
			delete(near, k)
		}
	}
}

// memoryNote says how near its ceiling a session is: "using 11.8 GB, near
// its 12 GB limit".
func memoryNote(u ProcUsage) string {
	return fmt.Sprintf("using %s, near its %s limit", gbOrMB(u.Memory), gbOrMB(u.MemoryHigh))
}
