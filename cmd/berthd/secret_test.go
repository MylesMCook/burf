package main

import (
	"encoding/json"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/sean-brydon/berthd/internal/box"
)

// The wrapper replaces its process, so the test runs it in a copy of the
// test binary.
func TestSecretExecHelper(t *testing.T) {
	if os.Getenv("BERTH_TEST_SECRET_EXEC") != "1" {
		t.Skip("run by TestSecretExecResolvesReferencesThenRunsTheProgram")
	}
	err := secretExec(boxHome{dir: t.TempDir()}, []string{"--socket", os.Getenv("BERTH_TEST_SOCKET"), "--", "/bin/sh", "-c", `echo "DB=${DB_PASSWORD-unset} MISSING=${MISSING-unset} PLAIN=$PLAIN VARS=${BERTH_SECRET_VARS-unset}"`})
	t.Fatalf("secret exec returned: %v", err)
}

func TestSecretExecResolvesReferencesThenRunsTheProgram(t *testing.T) {
	// A stub op; never the real one.
	dir := t.TempDir()
	op := filepath.Join(dir, "op")
	os.WriteFile(op, []byte(`#!/bin/sh
case "$2" in
op://dev/db/password) printf 'wrapped-secret-value\n' ;;
*) echo "[ERROR] 2024/01/01 00:00:00 \"$2\" isn't an item in the \"dev\" vault" >&2; exit 1 ;;
esac
`), 0o755)

	// A box that records what the wrapper reports.
	sockDir, err := os.MkdirTemp("/tmp", "bsx")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(sockDir)
	sock := filepath.Join(sockDir, "berthd.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var paths []string
	var got []box.SecretReport
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var rep box.SecretReport
		json.NewDecoder(r.Body).Decode(&rep)
		mu.Lock()
		paths, got = append(paths, r.Method+" "+r.URL.Path), append(got, rep)
		mu.Unlock()
		w.Write([]byte(`{"ok":true}`))
	})}
	go srv.Serve(ln)
	defer srv.Close()

	cmd := exec.Command(os.Args[0], "-test.run=^TestSecretExecHelper$")
	cmd.Env = append(os.Environ(),
		"BERTH_TEST_SECRET_EXEC=1", "BERTH_TEST_SOCKET="+sock, "BERTH_OP="+op, "PATH="+dir+":/usr/bin:/bin",
		"DB_PASSWORD=op://dev/db/password", "MISSING=op://dev/nope/field", "PLAIN=plain", "BERTH_SECRET_VARS=DB_PASSWORD,MISSING",
		"BERTH_LOCATION=cal", "BERTH_WORKTREE_NAME=billing", "BERTH_WORKTREE_PATH=/w/cal-billing")
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("%v: %s", err, out)
	}
	if strings.TrimSpace(string(out)) != "DB=wrapped-secret-value MISSING=unset PLAIN=plain VARS=unset" {
		t.Fatalf("program saw %q", out)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(got) != 1 || paths[0] != "POST /v1/secrets/report" {
		t.Fatalf("reported %v %+v", paths, got)
	}
	rep := got[0]
	if rep.Location != "cal" || rep.Name != "billing" || rep.Path != "/w/cal-billing" || len(rep.Results) != 2 {
		t.Fatalf("report = %+v", rep)
	}
	for _, r := range rep.Results {
		switch r.Variable {
		case "DB_PASSWORD":
			if r != (box.SecretResult{Variable: "DB_PASSWORD", Ref: "op://dev/db/password"}) {
				t.Fatalf("resolved result = %+v", r)
			}
		case "MISSING":
			if r.Ref != "op://dev/nope/field" || !strings.Contains(r.Reason, "isn't an item") {
				t.Fatalf("failed result = %+v", r)
			}
		default:
			t.Fatalf("result = %+v", r)
		}
	}
	raw, _ := json.Marshal(got)
	if strings.Contains(string(raw), "wrapped-secret-value") {
		t.Fatalf("the report carries a value: %s", raw)
	}
}
