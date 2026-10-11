// Package feedbackhttp provides the private local HTTP store used by the pinned
// Agentation toolbar and MCP client. It never opens a listener or starts a process.
package feedbackhttp

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/statefile"
)

const (
	maxBody         = 1 << 20
	maxSnapshot     = 16 << 20
	maxSessions     = 256
	maxAnnotations  = 4096
	maxThread       = 128
	maxEvents       = 512
	maxEventBytes   = 4 << 20
	maxSubscribers  = 32
	subscriberQueue = 32
)

type event struct {
	Type      string          `json:"type"`
	Timestamp string          `json:"timestamp"`
	SessionID string          `json:"sessionId"`
	Sequence  uint64          `json:"sequence"`
	Payload   json.RawMessage `json:"payload"`
}
type snapshot struct {
	Version     int               `json:"version"`
	Sequence    uint64            `json:"sequence"`
	Sessions    map[string]object `json:"sessions"`
	Annotations map[string]object `json:"annotations"`
	Events      []event           `json:"events"`
}
type subscriber struct {
	session string
	queue   chan event
	done    chan struct{}
}

// Store owns one private snapshot and its lifetime filesystem lock.
// Handler may serve concurrent requests. Close is idempotent.
type Store struct {
	mu                     sync.Mutex
	directory, path, token string
	state                  snapshot
	closed                 bool
	unlock                 func()
	subscribers            map[*subscriber]struct{}
	// Kept private so tests can demonstrate persistence failure without changing
	// host permissions or relying on filesystem timing.
	write func(string, []byte) error
}

// Open validates existing state without overwriting corrupt files. directory
// must be an absolute, application-owned path; token must be nonempty.
func Open(directory, token string) (*Store, error) {
	if !filepath.IsAbs(directory) || filepath.Clean(directory) != directory || len(token) < 16 || len(token) > 256 {
		return nil, errors.New("invalid feedback directory or token")
	}
	for _, c := range token {
		if c <= 32 || c >= 127 {
			return nil, errors.New("invalid feedback token")
		}
	}
	if err := safeDirectory(directory); err != nil {
		return nil, err
	}
	if err := statefile.EnsurePrivateDir(directory); err != nil {
		return nil, err
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(directory, 0o700); err != nil {
			return nil, err
		}
	}
	path := filepath.Join(directory, "store.json")
	for _, p := range []string{path, path + ".lock"} {
		if err := safeFile(p); err != nil {
			return nil, err
		}
	}
	unlock, acquired, err := statefile.TryLock(path)
	if err != nil {
		return nil, err
	}
	if !acquired {
		return nil, errors.New("feedback store is already open")
	}
	keep := false
	defer func() {
		if !keep {
			unlock()
		}
	}()
	if err := statefile.Private(path + ".lock"); err != nil {
		return nil, err
	}
	s := &Store{directory: directory, path: path, token: token, unlock: unlock, write: statefile.Write, subscribers: make(map[*subscriber]struct{}), state: snapshot{Version: 1, Sessions: make(map[string]object), Annotations: make(map[string]object), Events: []event{}}}
	f, err := os.Open(path)
	if err == nil {
		defer f.Close()
		data, readErr := io.ReadAll(io.LimitReader(f, maxSnapshot+1))
		if readErr != nil {
			return nil, readErr
		}
		if len(data) > maxSnapshot {
			return nil, errors.New("feedback snapshot is too large")
		}
		if err := decode(data, &s.state); err != nil {
			return nil, errors.New("invalid feedback snapshot; existing file preserved")
		}
		if err := validateSnapshot(s.state); err != nil {
			return nil, fmt.Errorf("invalid feedback snapshot; existing file preserved: %w", err)
		}
		if err := statefile.Private(path); err != nil {
			return nil, err
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	keep = true
	return s, nil
}

func safeDirectory(directory string) error {
	for p := directory; ; p = filepath.Dir(p) {
		info, err := os.Lstat(p)
		if err == nil {
			if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
				return errors.New("feedback path contains a symlink or non-directory")
			}
		} else if !os.IsNotExist(err) {
			return err
		}
		parent := filepath.Dir(p)
		if parent == p {
			break
		}
	}
	return nil
}
func safeFile(path string) error {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("feedback state must be a regular file")
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		return errors.New("feedback state permissions are not private")
	}
	return nil
}

func validateSnapshot(s snapshot) error {
	if s.Version != 1 || s.Sessions == nil || s.Annotations == nil || s.Events == nil || len(s.Sessions) > maxSessions || len(s.Annotations) > maxAnnotations || len(s.Events) > maxEvents || s.Sequence > 1<<53-1 {
		return errors.New("invalid snapshot version or limits")
	}
	for id, o := range s.Sessions {
		if id != textValue(o["id"]) || !validID(id) {
			return errors.New("invalid session identity")
		}
		if err := validate(o, sessionFields, "id", "url", "status", "createdAt"); err != nil {
			return err
		}
	}
	for id, o := range s.Annotations {
		if id != textValue(o["id"]) || !validID(id) || s.Sessions[textValue(o["sessionId"])] == nil {
			return errors.New("invalid annotation identity or session")
		}
		if err := validate(o, annotationFields, "id", "sessionId", "x", "y", "timestamp", "comment", "element", "elementPath", "status", "createdAt"); err != nil {
			return err
		}
	}
	var previous uint64
	total := 0
	for _, e := range s.Events {
		if e.Sequence == 0 || e.Sequence <= previous || e.Sequence > s.Sequence || s.Sessions[e.SessionID] == nil {
			return errors.New("invalid event sequence or session")
		}
		previous = e.Sequence
		if err := date(raw(e.Timestamp)); err != nil {
			return err
		}
		var o object
		if err := decode(e.Payload, &o); err != nil {
			return err
		}
		switch e.Type {
		case "session.created":
			if err := validate(o, sessionFields, "id", "url", "status", "createdAt"); err != nil {
				return err
			}
			if textValue(o["id"]) != e.SessionID {
				return errors.New("event session mismatch")
			}
		case "annotation.created", "annotation.updated", "annotation.deleted":
			if err := validate(o, annotationFields, "id", "sessionId", "x", "y", "timestamp", "comment", "element", "elementPath", "status", "createdAt"); err != nil {
				return err
			}
			if textValue(o["sessionId"]) != e.SessionID {
				return errors.New("event annotation session mismatch")
			}
		case "thread.message":
			if err := threadItem(e.Payload); err != nil {
				return err
			}
		default:
			return errors.New("unknown event type")
		}
		total += len(raw(e))
	}
	if total > maxEventBytes {
		return errors.New("event history is too large")
	}
	if len(s.Events) > 0 && s.Events[len(s.Events)-1].Sequence != s.Sequence {
		return errors.New("event tail does not match sequence")
	}
	if len(s.Events) == 0 && s.Sequence != 0 {
		return errors.New("missing event history")
	}
	return nil
}

func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}
func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }
func (s *Store) next() snapshot {
	return snapshot{Version: 1, Sequence: s.state.Sequence, Sessions: maps.Clone(s.state.Sessions), Annotations: maps.Clone(s.state.Annotations), Events: append([]event{}, s.state.Events...)}
}
func addEvent(next *snapshot, kind, session string, payload any) error {
	if next.Sequence >= 1<<53-1 {
		return errors.New("feedback event sequence exhausted")
	}
	candidate := event{kind, now(), session, next.Sequence + 1, raw(payload)}
	if len(raw(candidate)) > maxEventBytes {
		return errors.New("feedback event is too large")
	}
	next.Sequence++
	next.Events = append(next.Events, candidate)
	total := 0
	start := len(next.Events)
	for start > 0 && len(next.Events)-start < maxEvents {
		size := len(raw(next.Events[start-1]))
		if total+size > maxEventBytes {
			break
		}
		total += size
		start--
	}
	next.Events = append([]event{}, next.Events[start:]...)
	return nil
}

// commit must be called with mu held. No success response or event escapes
// before the replacement snapshot is durably written.
func (s *Store) commit(next snapshot, published []event) error {
	if s.closed {
		return errors.New("feedback store is closed")
	}
	if err := safeDirectory(s.directory); err != nil {
		return err
	}
	info, err := os.Lstat(s.directory)
	if err != nil {
		return err
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		return errors.New("feedback directory permissions are not private")
	}
	if err := safeFile(s.path); err != nil {
		return err
	}
	data, err := json.Marshal(next)
	if err != nil {
		return err
	}
	if len(data) > maxSnapshot {
		return errors.New("feedback storage limit reached")
	}
	if err := s.write(s.path, data); err != nil {
		return err
	}
	s.state = next
	// Publish every committed event, even when bounded history evicted an
	// earlier event from this same mutation's multi-event batch.
	for _, e := range published {
		for sub := range s.subscribers {
			if sub.session != "" && sub.session != e.SessionID {
				continue
			}
			select {
			case sub.queue <- e:
			default:
				close(sub.done)
				delete(s.subscribers, sub)
			}
		}
	}
	return nil
}

// Close cancels all active streams and releases the lifetime lock. Calls to the
// handler after Close fail even when the caller retains a valid bearer token.
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	for sub := range s.subscribers {
		close(sub.done)
		delete(s.subscribers, sub)
	}
	s.unlock()
	return nil
}
