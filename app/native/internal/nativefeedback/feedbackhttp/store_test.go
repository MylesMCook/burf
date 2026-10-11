package feedbackhttp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

const testToken = "synthetic-test-token"

func testDirectory(t *testing.T) string {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return filepath.Join(dir, "feedback")
}
func testStore(t *testing.T) (*Store, *httptest.Server) {
	t.Helper()
	s, err := Open(testDirectory(t), testToken)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(s.Handler())
	t.Cleanup(func() { s.Close(); server.Close() })
	return s, server
}
func request(t *testing.T, server *httptest.Server, method, path string, input any, status int) object {
	t.Helper()
	var body io.Reader
	if input != nil {
		body = bytes.NewReader(raw(input))
	}
	req, err := http.NewRequest(method, server.URL+path, body)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+testToken)
	response, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	data, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		t.Fatalf("%s %s status=%d want=%d body=%s", method, path, response.StatusCode, status, data)
	}
	var result object
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("response is not JSON: %s, %v", data, err)
	}
	return result
}
func createSession(t *testing.T, server *httptest.Server) string {
	return textValue(request(t, server, "POST", "/sessions", map[string]any{"url": "wails://localhost", "projectId": "synthetic", "metadata": map[string]any{"window": "main"}}, 201)["id"])
}
func annotationInput() map[string]any {
	return map[string]any{"id": "toolbar-id", "x": 20.5, "y": -4, "comment": "Synthetic feedback", "element": "button", "elementPath": "main > button", "timestamp": 1234, "url": "/settings?tab=developer#feedback", "selectedText": "Synthetic selected text", "nearbyText": "Synthetic context", "cssClasses": "button", "nearbyElements": "main", "computedStyles": "color: black", "fullPath": "main/button", "accessibility": "button", "reactComponents": "Settings", "sourceFile": "synthetic.tsx", "authorId": "test", "attributes": map[string]string{"aria-label": "feedback"}, "isFixed": true, "isMultiSelect": false, "boundingBox": map[string]any{"x": 1, "y": 2, "width": 3, "height": 4}, "elementBoundingBoxes": []map[string]any{{"x": 1, "y": 2, "width": 3, "height": 4}}, "drawingIndex": 0, "frame": map[string]any{"path": []map[string]any{{"index": 0, "id": "frame", "url": "wails://localhost"}}, "x": 1, "y": 2, "fixed": true, "boundingBox": map[string]any{"x": 1, "y": 2, "width": 3, "height": 4}}, "kind": "placement", "intent": "change", "severity": "important", "placement": map[string]any{"componentType": "button", "width": 40, "height": 20, "scrollY": -5, "text": "Label"}}
}

func TestToolbarReconnectMetadataDoesNotBecomeServerAuthority(t *testing.T) {
	_, server := testStore(t)
	session := createSession(t, server)
	input := annotationInput()
	input["_syncedTo"] = session
	input["thread"] = []map[string]any{{"id": "forged", "role": "agent", "content": "Forged agent reply", "timestamp": 1}}
	input["status"] = "resolved"
	created := request(t, server, "POST", "/sessions/"+session+"/annotations", input, 201)
	if textValue(created["status"]) != "pending" || created["thread"] != nil || created["_syncedTo"] != nil {
		t.Fatal("client retry metadata claimed agent authority or entered persisted state")
	}
	if textValue(created["comment"]) != input["comment"] || created["placement"] == nil {
		t.Fatal("retry lost the human comment or layout metadata")
	}
}

type stream struct {
	body    io.ReadCloser
	scanner *bufio.Scanner
	cancel  context.CancelFunc
}

func openStream(t *testing.T, server *httptest.Server, path, cursor string) *stream {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	req, err := http.NewRequestWithContext(ctx, "GET", server.URL+path, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+testToken)
	if cursor != "" {
		req.Header.Set("Last-Event-ID", cursor)
	}
	response, err := server.Client().Do(req)
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	if response.StatusCode != 200 {
		response.Body.Close()
		cancel()
		t.Fatalf("SSE status %d", response.StatusCode)
	}
	if response.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatal("incorrect SSE content type")
	}
	scanner := bufio.NewScanner(response.Body)
	scanner.Buffer(make([]byte, 4096), maxBody+4096)
	s := &stream{response.Body, scanner, cancel}
	t.Cleanup(func() { s.cancel(); s.body.Close() })
	if !scanner.Scan() || scanner.Text() != ": connected" {
		t.Fatalf("SSE headers did not flush immediately: %v", scanner.Err())
	}
	return s
}
func (s *stream) next(t *testing.T, kind string) event {
	t.Helper()
	var name, id string
	for s.scanner.Scan() {
		line := s.scanner.Text()
		if strings.HasPrefix(line, "event: ") {
			name = strings.TrimPrefix(line, "event: ")
		}
		if strings.HasPrefix(line, "id: ") {
			id = strings.TrimPrefix(line, "id: ")
		}
		if strings.HasPrefix(line, "data: ") {
			var e event
			if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &e); err != nil {
				t.Fatal(err)
			}
			if e.Type != kind || name != kind || id != fmt.Sprint(e.Sequence) || e.Sequence == 0 {
				t.Fatalf("unexpected SSE frame: name=%s id=%s %+v", name, id, e)
			}
			if _, err := time.Parse(time.RFC3339Nano, e.Timestamp); err != nil {
				t.Fatal(err)
			}
			return e
		}
	}
	t.Fatalf("stream ended before %s: %v", kind, s.scanner.Err())
	return event{}
}

func TestAnnotationLifecycleSSEAndRestart(t *testing.T) {
	store, server := testStore(t)
	global := openStream(t, server, "/events?agent=true", "")
	session := createSession(t, server)
	createdSession := global.next(t, "session.created")
	if createdSession.SessionID != session {
		t.Fatal("wrong session event")
	}
	scoped := openStream(t, server, "/sessions/"+session+"/events", "")
	input := annotationInput()
	annotation := request(t, server, "POST", "/sessions/"+session+"/annotations", input, 201)
	id := textValue(annotation["id"])
	if id == input["id"] || textValue(annotation["sessionId"]) != session || textValue(annotation["status"]) != "pending" {
		t.Fatal("server did not own annotation identity and initial status")
	}
	for key, value := range input {
		if key == "id" {
			continue
		}
		if !bytes.Equal(annotation[key], raw(value)) {
			t.Fatalf("metadata %s changed: %s", key, annotation[key])
		}
	}
	created := scoped.next(t, "annotation.created")
	globalCreated := global.next(t, "annotation.created")
	if created.Sequence != globalCreated.Sequence || created.Sequence <= createdSession.Sequence {
		t.Fatal("sequence is not shared and increasing")
	}
	if !bytes.Equal(created.Payload, raw(annotation)) {
		t.Fatal("created event did not carry full annotation")
	}
	pending := request(t, server, "GET", "/pending", nil, 200)
	if numericValue(pending["count"]) != 1 {
		t.Fatal("missing pending annotation")
	}
	request(t, server, "PATCH", "/annotations/"+id, map[string]string{"status": "acknowledged"}, 200)
	ack := scoped.next(t, "annotation.updated")
	if !bytes.Contains(ack.Payload, []byte(`"status":"acknowledged"`)) {
		t.Fatal("ack event wrong")
	}
	pending = request(t, server, "GET", "/sessions/"+session+"/pending", nil, 200)
	if numericValue(pending["count"]) != 0 {
		t.Fatal("acknowledged annotation remains pending")
	}
	reply := request(t, server, "POST", "/annotations/"+id+"/thread", map[string]string{"role": "agent", "content": "Synthetic reply"}, 201)
	replyUpdate := scoped.next(t, "annotation.updated")
	message := scoped.next(t, "thread.message")
	if message.Sequence != replyUpdate.Sequence+1 {
		t.Fatal("thread events not ordered")
	}
	var thread []object
	if err := json.Unmarshal(reply["thread"], &thread); err != nil || len(thread) != 1 {
		t.Fatalf("thread missing: %s", reply["thread"])
	}
	if !bytes.Equal(message.Payload, raw(thread[0])) {
		t.Fatal("thread event is not newly appended message")
	}
	resolved := request(t, server, "PATCH", "/annotations/"+id, map[string]string{"status": "resolved", "resolvedBy": "agent"}, 200)
	resolution := scoped.next(t, "annotation.updated")
	if textValue(resolved["status"]) != "resolved" || resolved["resolvedAt"] == nil || !bytes.Equal(resolution.Payload, raw(resolved)) {
		t.Fatal("resolution is incomplete")
	}
	sessionData := request(t, server, "GET", "/sessions/"+session, nil, 200)
	var annotations []object
	json.Unmarshal(sessionData["annotations"], &annotations)
	if len(annotations) != 1 || !bytes.Equal(raw(annotations[0]), raw(resolved)) {
		t.Fatal("session did not return complete resolved annotation")
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	for scoped.scanner.Scan() {
	}
	if err := scoped.scanner.Err(); err != nil {
		t.Fatal(err)
	}
	request(t, server, "GET", "/health", nil, 503)
	reopened, err := Open(store.directory, testToken)
	if err != nil {
		t.Fatal(err)
	}
	nextServer := httptest.NewServer(reopened.Handler())
	t.Cleanup(func() { reopened.Close(); nextServer.Close() })
	restored := request(t, nextServer, "GET", "/sessions/"+session, nil, 200)
	if !bytes.Equal(raw(restored), raw(sessionData)) {
		t.Fatal("restart changed annotation/session metadata")
	}
	replay := openStream(t, nextServer, "/sessions/"+session+"/events?agent=true", fmt.Sprint(replyUpdate.Sequence))
	replayedMessage := replay.next(t, "thread.message")
	replayedResolution := replay.next(t, "annotation.updated")
	if replayedMessage.Sequence != message.Sequence || replayedResolution.Sequence != resolution.Sequence {
		t.Fatal("restart did not retain replay history")
	}
	request(t, nextServer, "DELETE", "/annotations/"+id, nil, 200)
	deleted := replay.next(t, "annotation.deleted")
	if !bytes.Equal(deleted.Payload, raw(resolved)) {
		t.Fatal("deleted event lost metadata")
	}
	request(t, nextServer, "GET", "/sessions/unknown/pending", nil, 200)
}

func TestPersistenceFailureHasNoAcknowledgementOrEvents(t *testing.T) {
	s, server := testStore(t)
	session := createSession(t, server)
	o := request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 201)
	id := textValue(o["id"])
	before, err := os.ReadFile(s.path)
	if err != nil {
		t.Fatal(err)
	}
	sub := &subscriber{queue: make(chan event, subscriberQueue), done: make(chan struct{})}
	s.mu.Lock()
	sequence := s.state.Sequence
	s.subscribers[sub] = struct{}{}
	s.write = func(string, []byte) error { return errors.New("synthetic disk failure") }
	s.mu.Unlock()
	request(t, server, "PATCH", "/annotations/"+id, map[string]string{"status": "resolved", "resolvedBy": "agent"}, 503)
	request(t, server, "POST", "/annotations/"+id+"/thread", map[string]string{"role": "agent", "content": "Synthetic failed reply"}, 503)
	request(t, server, "DELETE", "/annotations/"+id, nil, 503)
	request(t, server, "POST", "/sessions", map[string]string{"url": "wails://localhost"}, 503)
	request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 503)
	s.mu.Lock()
	bad := s.state.Sequence != sequence || len(sub.queue) != 0
	s.mu.Unlock()
	if bad {
		t.Fatal("failed persistence changed sequence or emitted events")
	}
	after, err := os.ReadFile(s.path)
	if err != nil || !bytes.Equal(before, after) {
		t.Fatal("failed persistence changed disk")
	}
	pending := request(t, server, "GET", "/pending", nil, 200)
	if numericValue(pending["count"]) != 1 {
		t.Fatal("failed resolution changed pending state")
	}
	s.Close()
	reopened, err := Open(s.directory, testToken)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	if reopened.state.Sequence != sequence || textValue(reopened.state.Annotations[id]["status"]) != "pending" || reopened.state.Annotations[id]["thread"] != nil {
		t.Fatal("restart observed failed changes")
	}
}

func TestAuthAndInputRejection(t *testing.T) {
	_, server := testStore(t)
	session := createSession(t, server)
	o := request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 201)
	id := textValue(o["id"])
	for _, tc := range []struct {
		name, auth, origin string
		duplicate          bool
		status             int
	}{{"missing", "", "", false, 401}, {"wrong", "Bearer wrong", "", false, 401}, {"duplicate", "Bearer " + testToken, "", true, 401}, {"browser", "Bearer " + testToken, "wails://localhost", false, 403}} {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", server.URL+"/health", nil)
			if tc.auth != "" {
				req.Header.Set("Authorization", tc.auth)
			}
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.duplicate {
				req.Header.Add("Authorization", tc.auth)
			}
			resp, err := server.Client().Do(req)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()
			if resp.StatusCode != tc.status {
				t.Fatalf("status=%d", resp.StatusCode)
			}
		})
	}
	for _, path := range []string{"/sessions/bad.id", "/sessions/a%2Fb", "/sessions//events", "/health?agent=true", "/events?agent=true&agent=true", "/events?agent=false", "/events?unexpected=true"} {
		request(t, server, "GET", path, nil, 400)
	}
	for _, patch := range []map[string]any{{"status": "unknown"}, {"x": "wrong"}, {"isFixed": 0}, {"id": "override"}, {"sessionId": "override"}, {"thread": []any{}}, {"createdAt": "2026-10-10T00:00:00Z"}, {"unexpected": true}, {"resolvedBy": "agent"}, {"boundingBox": map[string]int{"x": 0, "y": 0, "width": -1, "height": 1}}} {
		request(t, server, "PATCH", "/annotations/"+id, patch, 400)
	}
	request(t, server, "POST", "/sessions/unknown/annotations", annotationInput(), 404)
	request(t, server, "POST", "/annotations/unknown/thread", map[string]string{"role": "agent", "content": "test"}, 404)
	request(t, server, "POST", "/annotations/"+id+"/thread", map[string]string{"role": "system", "content": "test"}, 400)
	request(t, server, "POST", "/annotations/"+id+"/thread", map[string]string{"role": "agent", "content": " "}, 400)
	for _, body := range []string{`{"url":"wails://localhost","url":"other"}`, `{"url":"wails://localhost"} {}`, `null`, `{"url":null}`, `{"url":"wails://localhost","metadata":{"nested":1,"nested":2}}`, string([]byte{'{', '"', 'u', 'r', 'l', '"', ':', '"', 0xff, '"', '}'})} {
		req, _ := http.NewRequest("POST", server.URL+"/sessions", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+testToken)
		resp, err := server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != 400 {
			t.Fatalf("accepted invalid JSON body %q", body)
		}
	}
	req, _ := http.NewRequest("POST", server.URL+"/sessions", strings.NewReader(strings.Repeat(" ", maxBody+1)))
	req.Header.Set("Authorization", "Bearer "+testToken)
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 413 {
		t.Fatal("oversized body accepted")
	}
	request(t, server, "GET", "/health", nil, 200)
	request(t, server, "PATCH", "/annotations/"+id, map[string]any{"kind": "rearrange", "rearrange": map[string]any{"selector": "button", "label": "button", "tagName": "BUTTON", "originalRect": map[string]int{"x": 0, "y": 0, "width": 1, "height": 1}, "currentRect": map[string]int{"x": 1, "y": 1, "width": 1, "height": 1}}}, 200)
}

func TestPrivatePathsCorruptionAndLifetimeLock(t *testing.T) {
	dir := testDirectory(t)
	s, err := Open(dir, testToken)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Open(dir, testToken); err == nil {
		t.Fatal("second store acquired lifetime lock")
	}
	s.Close()
	s.Close()
	data := []byte(`{"version":99,"sequence":0,"sessions":{},"annotations":{},"events":[]}`)
	if err := os.WriteFile(s.path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(dir, testToken); err == nil {
		t.Fatal("corrupt store opened")
	}
	got, _ := os.ReadFile(s.path)
	if !bytes.Equal(got, data) {
		t.Fatal("corrupt store overwritten")
	}
	if err := os.Remove(s.path); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(filepath.Dir(dir), "target")
	if err := os.WriteFile(target, []byte("unchanged"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, s.path); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	if _, err := Open(dir, testToken); err == nil {
		t.Fatal("symlink state opened")
	}
	os.Remove(s.path)
	os.Remove(s.path + ".lock")
	os.Symlink(target, s.path+".lock")
	if _, err := Open(dir, testToken); err == nil {
		t.Fatal("symlink lock opened")
	}
	os.Remove(s.path + ".lock")
	link := filepath.Join(filepath.Dir(dir), "directory-link")
	os.Symlink(dir, link)
	if _, err := Open(filepath.Join(link, "nested"), testToken); err == nil {
		t.Fatal("symlink ancestor opened")
	}
	got, _ = os.ReadFile(target)
	if string(got) != "unchanged" {
		t.Fatal("symlink target modified")
	}
	if runtime.GOOS != "windows" {
		os.WriteFile(s.path, []byte("{}"), 0o644)
		if _, err := Open(dir, testToken); err == nil {
			t.Fatal("exposed state opened")
		}
	}
}

func TestReplayZeroCursorScopeAndBackpressure(t *testing.T) {
	s, server := testStore(t)
	session := createSession(t, server)
	other := createSession(t, server)
	request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 201)
	request(t, server, "POST", "/sessions/"+other+"/annotations", annotationInput(), 201)
	pending := request(t, server, "GET", "/sessions/"+session+"/pending", nil, 200)
	if numericValue(pending["count"]) != 1 {
		t.Fatal("pending escaped session scope")
	}
	replay := openStream(t, server, "/sessions/"+session+"/events?agent=true", "0")
	first := replay.next(t, "session.created")
	second := replay.next(t, "annotation.created")
	if first.SessionID != session || second.SessionID != session {
		t.Fatal("replay escaped scope")
	}
	sub := &subscriber{queue: make(chan event, 1), done: make(chan struct{})}
	s.mu.Lock()
	s.subscribers[sub] = struct{}{}
	s.mu.Unlock()
	request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 201)
	request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 201)
	select {
	case <-sub.done:
	default:
		t.Fatal("slow subscriber not closed")
	}
	s.mu.Lock()
	_, present := s.subscribers[sub]
	s.mu.Unlock()
	if present {
		t.Fatal("slow subscriber retained")
	}
}

func TestConcurrentMutationsAndClose(t *testing.T) {
	s, server := testStore(t)
	session := createSession(t, server)
	var wg sync.WaitGroup
	for range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			body := bytes.NewReader(raw(annotationInput()))
			req, _ := http.NewRequest("POST", server.URL+"/sessions/"+session+"/annotations", body)
			req.Header.Set("Authorization", "Bearer "+testToken)
			resp, err := server.Client().Do(req)
			if err != nil {
				t.Error(err)
				return
			}
			resp.Body.Close()
			if resp.StatusCode != 201 {
				t.Errorf("status=%d", resp.StatusCode)
			}
		}()
	}
	wg.Wait()
	pending := request(t, server, "GET", "/pending", nil, 200)
	if numericValue(pending["count"]) != 12 {
		t.Fatal("concurrent mutations lost annotations")
	}
	stream := openStream(t, server, "/events?agent=true", "")
	s.Close()
	for stream.scanner.Scan() {
	}
	if err := stream.scanner.Err(); err != nil {
		t.Fatal(err)
	}
	request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 503)
}

func TestHistoryAndQuotaBoundaries(t *testing.T) {
	s, server := testStore(t)
	session := createSession(t, server)
	annotation := request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 201)
	id := textValue(annotation["id"])
	s.mu.Lock()
	next := s.next()
	s.mu.Unlock()
	for range maxEvents {
		next.Sequence++
		next.Events = append(next.Events, event{"annotation.updated", now(), session, next.Sequence, raw(annotation)})
	}
	if err := addEvent(&next, "annotation.updated", session, annotation); err != nil {
		t.Fatal(err)
	}
	if len(next.Events) > maxEvents || next.Events[0].Sequence <= 1 {
		t.Fatal("history was not bounded")
	}
	before := next.Sequence
	if err := addEvent(&next, "annotation.updated", session, strings.Repeat("x", maxEventBytes)); err == nil || next.Sequence != before {
		t.Fatal("oversized event changed candidate state")
	}
	if err := validateSnapshot(next); err != nil {
		t.Fatal(err)
	}
	// Reach the reply boundary with valid synthetic persisted data, then test
	// the real HTTP mutation. This avoids writing the same growth 128 times.
	thread := make([]object, maxThread)
	for i := range thread {
		thread[i] = object{"id": raw(fmt.Sprint(i)), "role": raw("agent"), "content": raw("synthetic"), "timestamp": raw(1234)}
	}
	s.mu.Lock()
	next = s.next()
	o := object{}
	for k, v := range annotation {
		o[k] = v
	}
	o["thread"] = raw(thread)
	next.Annotations[id] = o
	err := addEvent(&next, "annotation.updated", session, o)
	if err == nil {
		err = s.commit(next, nil)
	}
	s.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	request(t, server, "POST", "/annotations/"+id+"/thread", map[string]string{"role": "agent", "content": "over limit"}, 409)
	request(t, server, "PATCH", "/annotations/"+id, map[string]string{"status": "dismissed", "resolvedBy": "human"}, 200)
	pending := request(t, server, "GET", "/pending", nil, 200)
	if numericValue(pending["count"]) != 0 {
		t.Fatal("dismissed annotation is pending")
	}
}

func TestSessionsListAndStrictEmptyPending(t *testing.T) {
	s, server := testStore(t)
	first := createSession(t, server)
	second := createSession(t, server)
	// RFC3339 timestamps with optional fractions must sort by time, not text.
	s.mu.Lock()
	s.state.Sessions[first]["createdAt"] = raw("2026-10-10T00:00:00Z")
	s.state.Sessions[second]["createdAt"] = raw("2026-10-10T00:00:00.1Z")
	s.mu.Unlock()
	req, _ := http.NewRequest("GET", server.URL+"/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+testToken)
	response, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var list []object
	if err := json.NewDecoder(response.Body).Decode(&list); err != nil || response.StatusCode != 200 || len(list) != 2 || textValue(list[0]["id"]) != second {
		t.Fatalf("sessions list order: %s, %v", raw(list), err)
	}
	session := request(t, server, "GET", "/sessions/"+first, nil, 200)
	if string(session["annotations"]) != "[]" {
		t.Fatal("empty session annotations are not an array")
	}
	unknown := request(t, server, "GET", "/sessions/unknown/pending", nil, 200)
	if numericValue(unknown["count"]) != 0 || string(unknown["annotations"]) != "[]" {
		t.Fatal("unknown-session pending should be empty")
	}
}

func TestCorruptSnapshotEnumsAndOversizePreserveFile(t *testing.T) {
	s, server := testStore(t)
	session := createSession(t, server)
	annotation := request(t, server, "POST", "/sessions/"+session+"/annotations", annotationInput(), 201)
	id := textValue(annotation["id"])
	s.Close()
	var stored snapshot
	data, err := os.ReadFile(s.path)
	if err != nil {
		t.Fatal(err)
	}
	if err := decode(data, &stored); err != nil {
		t.Fatal(err)
	}
	stored.Annotations[id]["status"] = raw("unknown")
	corrupt := raw(stored)
	if err := os.WriteFile(s.path, corrupt, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(s.directory, testToken); err == nil {
		t.Fatal("unknown persisted state accepted")
	}
	got, _ := os.ReadFile(s.path)
	if !bytes.Equal(got, corrupt) {
		t.Fatal("unknown state overwritten")
	}
	oversized := bytes.Repeat([]byte(" "), maxSnapshot+1)
	if err := os.WriteFile(s.path, oversized, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(s.directory, testToken); err == nil {
		t.Fatal("oversized state accepted")
	}
	info, err := os.Stat(s.path)
	if err != nil || info.Size() != int64(len(oversized)) {
		t.Fatal("oversized state overwritten")
	}
}

func TestPrivateDirectoryLeavesAncestorsAlone(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix permission boundary")
	}
	dir := testDirectory(t)
	parent := filepath.Dir(dir)
	if err := os.Chmod(parent, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	s, err := Open(dir, testToken)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	info, _ := os.Stat(dir)
	parentInfo, _ := os.Stat(parent)
	if info.Mode().Perm() != 0o700 || parentInfo.Mode().Perm() != 0o755 {
		t.Fatal("private directory setup changed ancestor permissions")
	}
	server := httptest.NewServer(s.Handler())
	defer server.Close()
	createSession(t, server)
	for _, path := range []string{s.path, s.path + ".lock"} {
		info, err := os.Stat(path)
		if err != nil || info.Mode().Perm() != 0o600 {
			t.Fatal("persisted state or lifetime lock is not private")
		}
	}
	if err := os.Chmod(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	request(t, server, "POST", "/sessions", map[string]string{"url": "wails://localhost"}, 503)
}
