package feedbackhttp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

func (s *Store) events(w http.ResponseWriter, r *http.Request, session string) {
	var after uint64
	if len(r.Header.Values("Last-Event-ID")) > 1 {
		reject(w, 400, "invalid event cursor")
		return
	}
	if value := r.Header.Get("Last-Event-ID"); value != "" {
		var err error
		after, err = strconv.ParseUint(value, 10, 64)
		if err != nil || after > 1<<53-1 {
			reject(w, 400, "invalid event cursor")
			return
		}
	}
	if _, ok := w.(http.Flusher); !ok {
		reject(w, 500, "streaming unavailable")
		return
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		reject(w, 503, "feedback is disabled")
		return
	}
	if session != "" && s.state.Sessions[session] == nil {
		s.mu.Unlock()
		reject(w, 404, "session not found")
		return
	}
	if len(s.subscribers) >= maxSubscribers {
		s.mu.Unlock()
		reject(w, 503, "stream limit reached")
		return
	}
	// Capture replay and subscribe under one lock so a commit cannot fall into
	// the gap between historical events and the live stream.
	replay := []event{}
	if r.Header.Get("Last-Event-ID") != "" {
		for _, e := range s.state.Events {
			if e.Sequence > after && (session == "" || session == e.SessionID) {
				replay = append(replay, e)
			}
		}
	}
	sub := &subscriber{session: session, queue: make(chan event, subscriberQueue), done: make(chan struct{})}
	s.subscribers[sub] = struct{}{}
	s.mu.Unlock()
	defer func() { s.mu.Lock(); delete(s.subscribers, sub); s.mu.Unlock() }()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	control := http.NewResponseController(w)
	write := func(frame string) bool {
		select {
		case <-sub.done:
			return false
		case <-r.Context().Done():
			return false
		default:
		}
		// A bounded write deadline permits Close to finish even for a peer which
		// stops reading; store locks are never held during network writes.
		if err := control.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
			return false
		}
		if _, err := fmt.Fprint(w, frame); err != nil {
			return false
		}
		return control.Flush() == nil
	}
	if !write(": connected\n\n") {
		return
	}
	send := func(e event) bool {
		data, err := json.Marshal(e)
		if err != nil {
			return false
		}
		return write(fmt.Sprintf("event: %s\nid: %d\ndata: %s\n\n", e.Type, e.Sequence, data))
	}
	for _, e := range replay {
		if !send(e) {
			return
		}
	}
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-sub.done:
			return
		case e := <-sub.queue:
			if !send(e) {
				return
			}
		case <-ticker.C:
			if !write(": ping\n\n") {
				return
			}
		}
	}
}
