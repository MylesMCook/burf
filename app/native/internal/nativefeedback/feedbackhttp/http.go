package feedbackhttp

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"io"
	"maps"
	"net/http"
	"sort"
	"strings"
	"time"
)

// Handler serves the Origin-free backend. A trusted browser proxy must strip
// Origin and inject the bearer token; it remains responsible for its narrower
// toolbar capability, exact Host/Origin, and human-only PATCH field allowlist.
func (s *Store) Handler() http.Handler { return http.HandlerFunc(s.serve) }
func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}
func reject(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]string{"error": message})
}
func readObject(w http.ResponseWriter, r *http.Request) (object, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	defer r.Body.Close()
	data, err := io.ReadAll(r.Body)
	if err != nil {
		if _, ok := err.(*http.MaxBytesError); ok {
			reject(w, 413, "request body too large")
		} else {
			reject(w, 400, "invalid request body")
		}
		return nil, false
	}
	var o object
	if err := decode(data, &o); err != nil || o == nil {
		reject(w, 400, "invalid JSON object")
		return nil, false
	}
	return o, true
}
func (s *Store) serve(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	got := sha256.Sum256([]byte(r.Header.Get("Authorization")))
	want := sha256.Sum256([]byte("Bearer " + s.token))
	if len(r.Header.Values("Authorization")) != 1 || subtle.ConstantTimeCompare(got[:], want[:]) != 1 {
		reject(w, 401, "unauthorized")
		return
	}
	if _, ok := r.Header["Origin"]; ok {
		reject(w, 403, "browser origins are not allowed")
		return
	}
	if r.URL.RawPath != "" || strings.ContainsAny(r.URL.EscapedPath(), "%\\") || r.URL.Path == "" || strings.Contains(r.URL.Path, "//") {
		reject(w, 400, "invalid path")
		return
	}
	p := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
	events := r.URL.Path == "/events" || len(p) == 3 && p[0] == "sessions" && p[2] == "events"
	if r.URL.RawQuery != "" && (!events || r.URL.RawQuery != "agent=true") {
		reject(w, 400, "unsupported query")
		return
	}
	for i, x := range p {
		if (i == 1 && len(p) > 1 && (p[0] == "sessions" || p[0] == "annotations")) && !validID(x) {
			reject(w, 400, "invalid id")
			return
		}
	}
	if events && r.Method == http.MethodGet {
		session := ""
		if len(p) == 3 {
			session = p[1]
		}
		s.events(w, r, session)
		return
	}
	var input object
	if r.Method == http.MethodPost || r.Method == http.MethodPatch {
		var ok bool
		input, ok = readObject(w, r)
		if !ok {
			return
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		reject(w, 503, "feedback is disabled")
		return
	}
	switch {
	case r.URL.Path == "/health" && r.Method == http.MethodGet:
		respond(w, 200, map[string]string{"status": "ok", "mode": "local"})
	case r.URL.Path == "/sessions" && r.Method == http.MethodGet:
		sessions := make([]object, 0, len(s.state.Sessions))
		for _, o := range s.state.Sessions {
			sessions = append(sessions, o)
		}
		sort.Slice(sessions, func(i, j int) bool {
			a, _ := time.Parse(time.RFC3339Nano, textValue(sessions[i]["createdAt"]))
			b, _ := time.Parse(time.RFC3339Nano, textValue(sessions[j]["createdAt"]))
			if a.Equal(b) {
				return textValue(sessions[i]["id"]) < textValue(sessions[j]["id"])
			}
			return a.After(b)
		})
		respond(w, 200, sessions)
	case r.URL.Path == "/sessions" && r.Method == http.MethodPost:
		s.createSession(w, input)
	case r.URL.Path == "/pending" && r.Method == http.MethodGet:
		s.pending(w, "")
	case len(p) == 2 && p[0] == "sessions" && r.Method == http.MethodGet:
		session := s.state.Sessions[p[1]]
		if session == nil {
			reject(w, 404, "session not found")
			return
		}
		o := maps.Clone(session)
		o["annotations"] = raw(s.annotations(p[1], false))
		respond(w, 200, o)
	case len(p) == 3 && p[0] == "sessions" && p[2] == "pending" && r.Method == http.MethodGet:
		s.pending(w, p[1])
	case len(p) == 3 && p[0] == "sessions" && p[2] == "annotations" && r.Method == http.MethodPost:
		s.createAnnotation(w, p[1], input)
	case len(p) == 2 && p[0] == "annotations" && r.Method == http.MethodPatch:
		s.patchAnnotation(w, p[1], input)
	case len(p) == 2 && p[0] == "annotations" && r.Method == http.MethodDelete:
		s.deleteAnnotation(w, p[1])
	case len(p) == 3 && p[0] == "annotations" && p[2] == "thread" && r.Method == http.MethodPost:
		s.thread(w, p[1], input)
	default:
		reject(w, 404, "route not found")
	}
}
func (s *Store) annotations(session string, pending bool) []object {
	list := []object{}
	for _, o := range s.state.Annotations {
		if session != "" && textValue(o["sessionId"]) != session {
			continue
		}
		if pending && textValue(o["status"]) != "pending" {
			continue
		}
		list = append(list, o)
	}
	sort.Slice(list, func(i, j int) bool {
		a, b := numericValue(list[i]["timestamp"]), numericValue(list[j]["timestamp"])
		if a == b {
			return textValue(list[i]["id"]) < textValue(list[j]["id"])
		}
		return a < b
	})
	return list
}
func (s *Store) pending(w http.ResponseWriter, session string) {
	list := s.annotations(session, true)
	respond(w, 200, map[string]any{"count": len(list), "annotations": list})
}
func (s *Store) save(w http.ResponseWriter, next snapshot, events ...event) bool {
	published := make([]event, 0, len(events))
	for _, e := range events {
		if err := addEvent(&next, e.Type, e.SessionID, e.Payload); err != nil {
			reject(w, 503, "feedback storage unavailable")
			return false
		}
		published = append(published, next.Events[len(next.Events)-1])
	}
	if err := s.commit(next, published); err != nil {
		reject(w, 503, "feedback storage unavailable")
		return false
	}
	return true
}
func change(kind, session string, payload any) event {
	return event{Type: kind, SessionID: session, Payload: raw(payload)}
}
func (s *Store) createSession(w http.ResponseWriter, input object) {
	if err := validate(input, schema{"url": nonempty, "projectId": stringValue, "metadata": sessionFields["metadata"]}, "url"); err != nil {
		reject(w, 400, "invalid session")
		return
	}
	if len(s.state.Sessions) >= maxSessions {
		reject(w, 409, "session limit reached")
		return
	}
	id, err := newID()
	if err != nil {
		reject(w, 503, "identity unavailable")
		return
	}
	o := maps.Clone(input)
	o["id"] = raw(id)
	o["status"] = raw("active")
	o["createdAt"] = raw(now())
	next := s.next()
	next.Sessions[id] = o
	if s.save(w, next, change("session.created", id, o)) {
		respond(w, 201, o)
	}
}
func (s *Store) createAnnotation(w http.ResponseWriter, session string, input object) {
	if s.state.Sessions[session] == nil {
		reject(w, 404, "session not found")
		return
	}
	// The pinned toolbar resubmits its local synchronization marker on retry.
	// It is client bookkeeping. Agent replies belong only to the thread route.
	delete(input, "_syncedTo")
	delete(input, "thread")
	if err := validate(input, annotationFields, "x", "y", "timestamp", "comment", "element", "elementPath"); err != nil {
		reject(w, 400, "invalid annotation")
		return
	}
	if len(s.state.Annotations) >= maxAnnotations {
		reject(w, 409, "annotation limit reached")
		return
	}
	id, err := newID()
	if err != nil {
		reject(w, 503, "identity unavailable")
		return
	}
	o := maps.Clone(input)
	o["id"] = raw(id)
	o["sessionId"] = raw(session)
	o["status"] = raw("pending")
	o["createdAt"] = raw(now())
	if o["kind"] == nil {
		o["kind"] = raw("feedback")
	}
	delete(o, "updatedAt")
	delete(o, "resolvedAt")
	delete(o, "resolvedBy")
	next := s.next()
	next.Annotations[id] = o
	if s.save(w, next, change("annotation.created", session, o)) {
		respond(w, 201, o)
	}
}
func (s *Store) patchAnnotation(w http.ResponseWriter, id string, input object) {
	existing := s.state.Annotations[id]
	if existing == nil {
		reject(w, 404, "annotation not found")
		return
	}
	for _, k := range []string{"id", "sessionId", "createdAt", "updatedAt", "resolvedAt", "thread"} {
		if _, ok := input[k]; ok {
			reject(w, 400, "server-owned annotation field")
			return
		}
	}
	if len(input) == 0 {
		reject(w, 400, "empty patch")
		return
	}
	if err := validate(input, annotationFields); err != nil {
		reject(w, 400, "invalid annotation patch")
		return
	}
	o := maps.Clone(existing)
	maps.Copy(o, input)
	o["updatedAt"] = raw(now())
	if _, ok := input["status"]; ok {
		status := textValue(o["status"])
		if status == "resolved" || status == "dismissed" {
			o["resolvedAt"] = raw(now())
			if o["resolvedBy"] == nil {
				o["resolvedBy"] = raw("agent")
			}
		} else {
			delete(o, "resolvedAt")
			delete(o, "resolvedBy")
		}
	}
	if _, ok := input["resolvedBy"]; ok && textValue(o["status"]) != "resolved" && textValue(o["status"]) != "dismissed" {
		reject(w, 400, "resolution role requires resolved or dismissed status")
		return
	}
	session := textValue(o["sessionId"])
	next := s.next()
	next.Annotations[id] = o
	if s.save(w, next, change("annotation.updated", session, o)) {
		respond(w, 200, o)
	}
}
func (s *Store) deleteAnnotation(w http.ResponseWriter, id string) {
	o := s.state.Annotations[id]
	if o == nil {
		reject(w, 404, "annotation not found")
		return
	}
	next := s.next()
	delete(next.Annotations, id)
	if s.save(w, next, change("annotation.deleted", textValue(o["sessionId"]), o)) {
		respond(w, 200, map[string]any{"deleted": true, "annotationId": id})
	}
}
func (s *Store) thread(w http.ResponseWriter, id string, input object) {
	existing := s.state.Annotations[id]
	if existing == nil {
		reject(w, 404, "annotation not found")
		return
	}
	if err := validate(input, schema{"role": role, "content": nonempty}, "role", "content"); err != nil {
		reject(w, 400, "invalid thread message")
		return
	}
	messages := []object{}
	if b := existing["thread"]; b != nil {
		json.Unmarshal(b, &messages)
	}
	if len(messages) >= maxThread {
		reject(w, 409, "thread limit reached")
		return
	}
	messageID, err := newID()
	if err != nil {
		reject(w, 503, "identity unavailable")
		return
	}
	message := maps.Clone(input)
	message["id"] = raw(messageID)
	message["timestamp"] = raw(time.Now().UnixMilli())
	messages = append(messages, message)
	o := maps.Clone(existing)
	o["thread"] = raw(messages)
	o["updatedAt"] = raw(now())
	session := textValue(o["sessionId"])
	next := s.next()
	next.Annotations[id] = o
	if s.save(w, next, change("annotation.updated", session, o), change("thread.message", session, message)) {
		respond(w, 201, o)
	}
}
