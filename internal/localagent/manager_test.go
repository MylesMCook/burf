package localagent

import (
	"encoding/base64"
	"io"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeProcess struct {
	r     *io.PipeReader
	w     *io.PipeWriter
	once  sync.Once
	mu    sync.Mutex
	input string
	dims  [2]int
}

func fake() *fakeProcess                          { r, w := io.Pipe(); return &fakeProcess{r: r, w: w} }
func (p *fakeProcess) Read(b []byte) (int, error) { return p.r.Read(b) }
func (p *fakeProcess) Write(b []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.input += string(b)
	return len(b), nil
}
func (p *fakeProcess) Resize(c, r int) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.dims = [2]int{c, r}
	return nil
}
func (p *fakeProcess) Wait() error  { return nil }
func (p *fakeProcess) Close() error { p.once.Do(func() { p.w.Close() }); return nil }

func TestOwnedSessionRoundTrip(t *testing.T) {
	p := fake()
	dir := t.TempDir()
	m := New(map[string]Command{"codex": {Program: "native.exe"}}, func(program string, args []string, cwd string, env []string, c, r int) (Process, error) {
		if program != "native.exe" || cwd != dir || len(args) != 0 || len(env) == 0 || c != 100 || r != 30 {
			t.Fatal("incorrect launch")
		}
		return p, nil
	})
	defer m.Close()
	s, err := m.Start("codex", dir)
	if err != nil {
		t.Fatal(err)
	}
	if s.State != "running" || s.ID == "" {
		t.Fatal(s)
	}
	go func() { _, _ = p.w.Write([]byte("hello\x1b[32m世界")) }()
	waitFor(t, func() bool { o, _ := m.Output(s.ID, 0); return o.Next > 0 })
	o, err := m.Output(s.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	decoded, _ := base64.StdEncoding.DecodeString(o.Data)
	if string(decoded) != "hello\x1b[32m世界" {
		t.Fatalf("output %q", decoded)
	}
	empty, _ := m.Output(s.ID, o.Next)
	if empty.Data != "" || empty.Reset {
		t.Fatal(empty)
	}
	if err := m.Input(s.ID, "yes\r"); err != nil {
		t.Fatal(err)
	}
	if err := m.Resize(s.ID, 120, 40); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { p.mu.Lock(); defer p.mu.Unlock(); return p.input == "yes\r" })
	p.mu.Lock()
	if p.input != "yes\r" || p.dims != [2]int{120, 40} {
		t.Error("input or resize not forwarded")
	}
	p.mu.Unlock()
	if err := m.Stop("external-session"); err != ErrNotFound {
		t.Fatal("external process accepted", err)
	}
	if m.PrepareRestart() == nil {
		t.Fatal("restart accepted with running session")
	}
	if err := m.Stop(s.ID); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return m.List()[0].State == "exited" })
	if err := m.PrepareRestart(); err != nil {
		t.Fatal(err)
	}
	if m.Input(s.ID, "ignored") == nil {
		t.Fatal("input after exit accepted")
	}
}

func TestLaunchValidationAndShutdown(t *testing.T) {
	calls := 0
	m := New(map[string]Command{"claude": {Program: "claude.exe"}}, func(string, []string, string, []string, int, int) (Process, error) { calls++; return fake(), nil })
	dir := t.TempDir()
	for _, tc := range [][2]string{{"shell", dir}, {"claude", "relative"}, {"claude", dir + "/missing"}} {
		if _, err := m.Start(tc[0], tc[1]); err == nil {
			t.Fatal("invalid launch accepted", tc)
		}
	}
	if calls != 0 {
		t.Fatal("invalid launch ran process")
	}
	for i := 0; i < 8; i++ {
		if _, err := m.Start("claude", dir); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := m.Start("claude", dir); err == nil {
		t.Fatal("session limit not enforced")
	}
	m.Close()
	if _, err := m.Start("claude", dir); err == nil {
		t.Fatal("launch after shutdown")
	}
}

func TestBoundedOutputResetsCursor(t *testing.T) {
	p := fake()
	m := New(map[string]Command{"claude": {Program: "claude.exe"}}, func(string, []string, string, []string, int, int) (Process, error) { return p, nil })
	defer m.Close()
	s, err := m.Start("claude", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	data := strings.Repeat("a", outputLimit+4096)
	go func() { _, _ = p.w.Write([]byte(data)) }()
	waitFor(t, func() bool { o, _ := m.Output(s.ID, 0); return o.Next == int64(len(data)) })
	o, _ := m.Output(s.ID, 0)
	decoded, _ := base64.StdEncoding.DecodeString(o.Data)
	if !o.Reset || len(decoded) != outputLimit {
		t.Fatalf("unbounded or stale output: reset %v len %d", o.Reset, len(decoded))
	}
	if err := m.Resize(s.ID, 0, 1); err == nil {
		t.Fatal("invalid dimensions accepted")
	}
	if err := m.Input(s.ID, strings.Repeat("a", 65537)); err == nil {
		t.Fatal("unbounded input accepted")
	}
}

func waitFor(t *testing.T, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("timed out")
}

type blockedWriter struct {
	*fakeProcess
	blocked chan struct{}
	closed  chan struct{}
	stop    sync.Once
}

func (p *blockedWriter) Write([]byte) (int, error) {
	select {
	case p.blocked <- struct{}{}:
	default:
	}
	<-p.closed
	return 0, io.ErrClosedPipe
}

func (p *blockedWriter) Close() error {
	p.stop.Do(func() { close(p.closed); p.fakeProcess.Close() })
	return nil
}

func TestBlockedInputHasBoundedQueueAndCanStop(t *testing.T) {
	p := &blockedWriter{fakeProcess: fake(), blocked: make(chan struct{}, 1), closed: make(chan struct{})}
	m := New(map[string]Command{"codex": {Program: "native.exe"}}, func(string, []string, string, []string, int, int) (Process, error) { return p, nil })
	defer m.Close()
	s, err := m.Start("codex", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err = m.Input(s.ID, "first"); err != nil {
		t.Fatal(err)
	}
	select {
	case <-p.blocked:
	case <-time.After(time.Second):
		t.Fatal("writer not reached")
	}
	for i := 0; i < 8; i++ {
		if err = m.Input(s.ID, "queued"); err != nil {
			t.Fatal(err)
		}
	}
	if err = m.Input(s.ID, "overflow"); err == nil {
		t.Fatal("unbounded input accepted")
	}
	done := make(chan struct{})
	go func() { m.Stop(s.ID); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("stop blocked behind input")
	}
	waitFor(t, func() bool { return m.List()[0].State == "exited" })
}
