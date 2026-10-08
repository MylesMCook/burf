//go:build unix

package main

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/MylesMCook/burf/internal/agent"
)

// browserCLI runs `burf browser ARGS` against a synthetic agent that records
// what the command asked for, and returns what the command printed.
func browserCLI(t *testing.T, args ...string) (string, []string, error) {
	t.Helper()
	// A Unix socket path must stay short; t.TempDir is too long on macOS.
	dir, err := os.MkdirTemp("/tmp", "burf-cli-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	l := laptop{dir: dir}
	if err = os.MkdirAll(filepath.Dir(l.socket()), 0o700); err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var asked []string
	record := func(r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		asked = append(asked, r.Method+" "+r.URL.Path)
	}
	mux := http.NewServeMux()
	reply := func(body string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			record(r)
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, body)
		}
	}
	mux.HandleFunc("GET /v1/status", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(agent.Status{}) })
	mux.HandleFunc("POST /v1/browser/pairing", reply(`{"code":"ABCD-EFGH","expires_at":"2026-10-08T20:00:00Z"}`))
	mux.HandleFunc("GET /v1/browser/pairings", reply(`{"pairings":[{"id":"a1b2c3","name":"Work Chrome","origin":"chrome-extension://abcdefghijklmnopabcdefghijklmnop","created":"2026-10-08T19:00:00Z"}]}`))
	mux.HandleFunc("DELETE /v1/browser/pairings/{id}", func(w http.ResponseWriter, r *http.Request) {
		record(r)
		if r.PathValue("id") != "a1b2c3" {
			w.WriteHeader(http.StatusNotFound)
			io.WriteString(w, `{"error":"no paired browser with that id"}`)
			return
		}
		io.WriteString(w, `{"ok":true}`)
	})
	ln, err := net.Listen("unix", l.socket())
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: mux}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close() })

	// The command starts a real agent when none answers; never let it.
	if !agent.NewClient(l.socket()).Running(context.Background()) {
		t.Fatal("the synthetic agent is not answering")
	}

	stdout := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	runErr := browserCmd(l, args)
	w.Close()
	os.Stdout = stdout
	printed, _ := io.ReadAll(r)
	mu.Lock()
	defer mu.Unlock()
	return string(printed), asked, runErr
}

func TestBrowserCommandPairsListsAndRevokes(t *testing.T) {
	out, asked, err := browserCLI(t, "pair")
	if err != nil || !strings.HasPrefix(out, "ABCD-EFGH\n") || !strings.Contains(out, "works once") || len(asked) != 1 || asked[0] != "POST /v1/browser/pairing" {
		t.Fatalf("pair: %v %q %v", err, out, asked)
	}
	out, _, err = browserCLI(t, "list")
	if err != nil || !strings.Contains(out, "a1b2c3") || !strings.Contains(out, "Work Chrome") || !strings.Contains(out, "chrome-extension://") {
		t.Fatalf("list: %v %q", err, out)
	}
	out, _, err = browserCLI(t, "list", "--json")
	var listed []agent.BrowserPairing
	if err != nil || json.Unmarshal([]byte(out), &listed) != nil || len(listed) != 1 || listed[0].ID != "a1b2c3" {
		t.Fatalf("list --json: %v %q", err, out)
	}
	out, asked, err = browserCLI(t, "revoke", "a1b2c3")
	if err != nil || !strings.Contains(out, "Revoked") || asked[0] != "DELETE /v1/browser/pairings/a1b2c3" {
		t.Fatalf("revoke: %v %q %v", err, out, asked)
	}
	if _, _, err = browserCLI(t, "revoke", "unknown"); err == nil || !strings.Contains(err.Error(), "no paired browser") {
		t.Fatalf("revoking an unknown browser: %v", err)
	}
	for _, bad := range [][]string{{}, {"pair", "extra"}, {"revoke"}, {"list", "--yaml"}, {"token"}} {
		if out, asked, err = browserCLI(t, bad...); err == nil || !strings.Contains(err.Error(), "usage: burf browser") || out != "" || len(asked) != 0 {
			t.Fatalf("burf browser %v: %v %q %v", bad, err, out, asked)
		}
	}
}
