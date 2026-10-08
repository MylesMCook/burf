// Package localhistory discovers local agent conversations without adopting
// their processes or modifying the agents' files.
package localhistory

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/sean-brydon/berthd/internal/transcript"
)

const (
	maxEntries       = 20000
	maxCandidates    = 1000
	maxConversations = 500
	metadataBytes    = 256 << 10
	metadataLines    = 128
	pageSize         = 100
)

var ErrNotFound = errors.New("local conversation not found")
var sessionID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{7,127}$`)

type Config struct {
	CodexHome  string
	ClaudeHome string
}

type Conversation struct {
	ID        string    `json:"id"`
	Source    string    `json:"source"`
	Title     string    `json:"title"`
	Cwd       string    `json:"cwd"`
	UpdatedAt time.Time `json:"updated_at"`
	ReadOnly  bool      `json:"read_only"`
}

type record struct {
	Conversation
	home     string
	path     string
	identity string
	fileInfo os.FileInfo
}

type Store struct {
	config  Config
	mu      sync.RWMutex
	records map[string]record
}

func New(config Config) *Store {
	home, _ := os.UserHomeDir()
	if config.CodexHome == "" {
		config.CodexHome = defaultHome("CODEX_HOME", home, ".codex")
	}
	if config.ClaudeHome == "" {
		config.ClaudeHome = defaultHome("CLAUDE_CONFIG_DIR", home, ".claude")
	}
	return &Store{config: config, records: map[string]record{}}
}

func defaultHome(env, home, name string) string {
	if value := os.Getenv(env); value != "" {
		return value
	}
	if home == "" {
		return ""
	}
	return filepath.Join(home, name)
}

// List returns the newest conversations, with fixed traversal and metadata
// budgets. Missing agent installations are empty sources, not errors.
func (s *Store) List(ctx context.Context) ([]Conversation, error) {
	all := make([]record, 0)
	for _, source := range []struct {
		name, home, dir string
		depth           int
	}{
		{"codex", s.config.CodexHome, "sessions", 4},
		{"claude", s.config.ClaudeHome, "projects", 2},
	} {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if source.home == "" {
			continue
		}
		root, err := os.OpenRoot(source.home)
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("cannot open %s history", source.name)
		}
		candidates, err := discover(ctx, root, source.name, source.dir, source.depth)
		if err == nil {
			for _, candidate := range candidates {
				if err = ctx.Err(); err != nil {
					break
				}
				f, openErr := safeOpen(root, candidate.path)
				if openErr != nil {
					continue
				}
				id, cwd, title := metadata(f, source.name)
				info, statErr := f.Stat()
				f.Close()
				if id == "" || cwd == "" || statErr != nil {
					continue
				}
				if source.name == "claude" && strings.TrimSuffix(filepath.Base(candidate.path), ".jsonl") != id {
					continue
				}
				digest := sha256.Sum256([]byte(source.name + "\x00" + id))
				candidate.Conversation = Conversation{
					ID: hex.EncodeToString(digest[:]), Source: source.name, Title: title,
					Cwd: cwd, UpdatedAt: candidate.UpdatedAt, ReadOnly: true,
				}
				if candidate.Title == "" {
					candidate.Title = source.name + " conversation"
				}
				candidate.home, candidate.identity = source.home, id
				candidate.fileInfo = info
				all = append(all, candidate)
			}
		}
		root.Close()
		if err != nil {
			return nil, err
		}
	}
	sort.Slice(all, func(i, j int) bool {
		if all[i].UpdatedAt.Equal(all[j].UpdatedAt) {
			return all[i].path < all[j].path
		}
		return all[i].UpdatedAt.After(all[j].UpdatedAt)
	})
	selected := map[string]record{}
	result := make([]Conversation, 0, min(len(all), maxConversations))
	for _, r := range all {
		if _, exists := selected[r.ID]; exists {
			continue
		}
		selected[r.ID] = r
		result = append(result, r.Conversation)
		if len(result) == maxConversations {
			break
		}
	}
	s.mu.Lock()
	s.records = selected
	s.mu.Unlock()
	return result, nil
}

// Read accepts only an opaque ID from discovery. Revalidate the source record
// before reading, so a replaced file cannot silently become another chat.
func (s *Store) Read(ctx context.Context, id string, before int64) (transcript.Result, error) {
	r, f, err := s.openRecord(ctx, id)
	if err != nil {
		return transcript.Result{}, err
	}
	defer f.Close()
	result, err := transcript.BeforeFile(r.Source, f, r.Cwd, before, pageSize)
	if err != nil {
		return transcript.Result{}, errors.New("cannot read local conversation")
	}
	if err := ctx.Err(); err != nil {
		return transcript.Result{}, err
	}
	return result, nil
}

type Continuation struct {
	Source    string
	SessionID string
	Cwd       string
}

// Continuation resolves only discovered, still-valid history. Callers cannot
// supply a transcript path, command line or raw session ID through the API.
func (s *Store) Continuation(ctx context.Context, id string) (Continuation, error) {
	r, f, err := s.openRecord(ctx, id)
	if err != nil {
		return Continuation{}, err
	}
	f.Close()
	return Continuation{Source: r.Source, SessionID: r.identity, Cwd: r.Cwd}, nil
}

func (s *Store) openRecord(ctx context.Context, id string) (record, *os.File, error) {
	if err := ctx.Err(); err != nil {
		return record{}, nil, err
	}
	s.mu.RLock()
	r, ok := s.records[id]
	s.mu.RUnlock()
	if !ok {
		return record{}, nil, ErrNotFound
	}
	root, err := os.OpenRoot(r.home)
	if err != nil {
		return record{}, nil, ErrNotFound
	}
	defer root.Close()
	f, err := safeOpen(root, r.path)
	if err != nil {
		return record{}, nil, ErrNotFound
	}
	identity, cwd, _ := metadata(f, r.Source)
	info, statErr := f.Stat()
	if identity != r.identity || cwd != r.Cwd || statErr != nil || !os.SameFile(r.fileInfo, info) || info.Size() < r.fileInfo.Size() {
		f.Close()
		return record{}, nil, ErrNotFound
	}
	if err := ctx.Err(); err != nil {
		f.Close()
		return record{}, nil, err
	}
	return r, f, nil
}

// Reject links before opening; os.Root additionally prevents a concurrent
// replacement from escaping the configured source directory.
func safeOpen(root *os.Root, path string) (*os.File, error) {
	if !filepath.IsLocal(path) {
		return nil, fs.ErrPermission
	}
	parts := strings.Split(filepath.Clean(path), string(filepath.Separator))
	for i := range parts {
		st, err := root.Lstat(filepath.Join(parts[:i+1]...))
		if err != nil {
			return nil, err
		}
		if st.Mode()&(os.ModeSymlink|os.ModeIrregular) != 0 {
			return nil, fs.ErrPermission
		}
	}
	f, err := root.Open(path)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil || (!st.IsDir() && !st.Mode().IsRegular()) {
		f.Close()
		return nil, fs.ErrPermission
	}
	return f, nil
}

func discover(ctx context.Context, root *os.Root, source, dir string, depth int) ([]record, error) {
	remaining := maxEntries
	files := make([]record, 0)
	var walk func(string, int) error
	walk = func(path string, level int) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		f, err := safeOpen(root, path)
		if err != nil {
			return nil
		}
		defer f.Close()
		for remaining > 0 {
			entries, err := f.ReadDir(min(128, remaining))
			remaining -= len(entries)
			for _, entry := range entries {
				if entry.Type()&(os.ModeSymlink|os.ModeIrregular) != 0 {
					continue
				}
				child := filepath.Join(path, entry.Name())
				if entry.IsDir() && level < depth-1 {
					if err := walk(child, level+1); err != nil {
						return err
					}
					continue
				}
				if entry.IsDir() || level != depth-1 || !strings.HasSuffix(entry.Name(), ".jsonl") {
					continue
				}
				if source == "codex" && !strings.HasPrefix(entry.Name(), "rollout-") {
					continue
				}
				if source == "claude" && !sessionID.MatchString(strings.TrimSuffix(entry.Name(), ".jsonl")) {
					continue
				}
				st, statErr := entry.Info()
				if statErr != nil || !st.Mode().IsRegular() {
					continue
				}
				files = append(files, record{Conversation: Conversation{UpdatedAt: st.ModTime()}, path: child})
			}
			if err != nil {
				break
			}
		}
		return nil
	}
	if err := walk(dir, 0); err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].UpdatedAt.Equal(files[j].UpdatedAt) {
			return files[i].path < files[j].path
		}
		return files[i].UpdatedAt.After(files[j].UpdatedAt)
	})
	return files[:min(len(files), maxCandidates)], nil
}

func metadata(f *os.File, source string) (id, cwd, title string) {
	r := bufio.NewReaderSize(io.LimitReader(f, metadataBytes), 32<<10)
	for n := 0; n < metadataLines; n++ {
		line, err := r.ReadBytes('\n')
		if err != nil {
			break
		} // Ignore a partial record still being written.
		var entry struct {
			Type      string `json:"type"`
			Cwd       string `json:"cwd"`
			SessionID string `json:"sessionId"`
			Sidechain bool   `json:"isSidechain"`
			Meta      bool   `json:"isMeta"`
			Compact   bool   `json:"isCompactSummary"`
			Payload   struct {
				ID      string          `json:"id"`
				Cwd     string          `json:"cwd"`
				Source  json.RawMessage `json:"source"`
				Type    string          `json:"type"`
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"payload"`
			Message struct {
				Content json.RawMessage `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(line, &entry) != nil {
			continue
		}
		if source == "codex" {
			if entry.Type == "session_meta" {
				if strings.Contains(string(entry.Payload.Source), "subagent") {
					return "", "", ""
				}
				id, cwd = entry.Payload.ID, entry.Payload.Cwd
			}
			if title == "" && entry.Type == "response_item" && entry.Payload.Type == "message" && entry.Payload.Role == "user" {
				title = titleText(entry.Payload.Content)
			}
		} else {
			if entry.Sidechain {
				return "", "", ""
			}
			if (entry.Type == "user" || entry.Type == "assistant") && entry.SessionID != "" && entry.Cwd != "" {
				if id != "" && id != entry.SessionID {
					return "", "", ""
				}
				id, cwd = entry.SessionID, entry.Cwd
			}
			if title == "" && entry.Type == "user" && !entry.Meta && !entry.Compact {
				title = titleText(entry.Message.Content)
			}
		}
	}
	if !sessionID.MatchString(id) || len(cwd) > 32768 {
		return "", "", ""
	}
	return id, cwd, title
}

func titleText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) != nil {
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(raw, &blocks) != nil {
			return ""
		}
		for _, block := range blocks {
			if block.Type == "text" || block.Type == "input_text" {
				text += block.Text + "\n"
			}
		}
	}
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "<") || strings.HasPrefix(text, "# AGENTS.md instructions") || strings.HasPrefix(text, "Caveat:") {
		return ""
	}
	line, _, _ := strings.Cut(text, "\n")
	chars := []rune(strings.TrimSpace(line))
	return string(chars[:min(len(chars), 120)])
}
