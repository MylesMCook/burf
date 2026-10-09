package box

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http/httptest"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/doctor"
	"github.com/MylesMCook/burf/internal/events"
)

func TestWithAgentBrowserIdle(t *testing.T) {
	t.Setenv(AgentBrowserIdleEnv, "")
	os.Unsetenv(AgentBrowserIdleEnv)
	if got := withAgentBrowserIdle([]string{"A=1"}); !slices.Equal(got, []string{"A=1", AgentBrowserIdleEnv + "=" + AgentBrowserIdleDefault}) {
		t.Fatalf("default: %v", got)
	}
	if got := withAgentBrowserIdle([]string{AgentBrowserIdleEnv + "=0"}); !slices.Equal(got, []string{AgentBrowserIdleEnv + "=0"}) {
		t.Fatalf("a value the box or project set was replaced: %v", got)
	}
	t.Setenv(AgentBrowserIdleEnv, "30000")
	if got := withAgentBrowserIdle(nil); len(got) != 0 {
		t.Fatalf("berthd's own environment sets it, yet: %v", got)
	}
}

// Every session berth starts closes an idle agent-browser after ten
// minutes, unless the box's env.json or the project's env says otherwise.
func TestSessionsGetAgentBrowserIdleTimeout(t *testing.T) {
	t.Setenv(AgentBrowserIdleEnv, "")
	os.Unsetenv(AgentBrowserIdleEnv)
	ctx := context.Background()
	repo := gitRepo(t)
	dir := t.TempDir()
	b := &Box{Name: "devbox", Locations: NewLocations(filepath.Join(dir, "locations.json")), Events: &events.Bus{}, EnvFile: filepath.Join(dir, "env.json"), Sessions: testSessions(t)}
	b.Locations.Add(ctx, "hello", repo)
	wt, err := b.Locations.CreateWorktree(ctx, "hello", "idle", "", "")
	if err != nil {
		t.Fatal(err)
	}
	n := 0
	valueIn := func(cwd string, start func(name, command string) error) string {
		t.Helper()
		n++
		out := filepath.Join(dir, "out"+string(rune('0'+n)))
		name := "idle" + string(rune('0'+n))
		if err := start(name, `printf '%s' "${`+AgentBrowserIdleEnv+`-unset}" > `+out); err != nil {
			t.Fatal(err)
		}
		deadline := time.Now().Add(10 * time.Second)
		for time.Now().Before(deadline) {
			if b, err := os.ReadFile(out); err == nil && len(b) > 0 {
				return string(b)
			}
			time.Sleep(50 * time.Millisecond)
		}
		t.Fatalf("session %s wrote nothing", name)
		return ""
	}
	inWorktree := func(name, command string) error {
		_, err := b.createAgentSession(ctx, name, "hello/idle", wt.Path, command, "")
		return err
	}
	if v := valueIn(wt.Path, inWorktree); v != AgentBrowserIdleDefault {
		t.Fatalf("a worktree's session got %q", v)
	}
	if v := valueIn(dir, func(name, command string) error {
		_, err := b.Sessions.Create(ctx, name, "", dir, command, nil)
		return err
	}); v != AgentBrowserIdleDefault {
		t.Fatalf("a session outside any worktree got %q", v)
	}
	if err := saveBoxEnv(b.EnvFile, BoxEnv{Env: map[string]string{AgentBrowserIdleEnv: "120000"}}); err != nil {
		t.Fatal(err)
	}
	if v := valueIn(wt.Path, inWorktree); v != "120000" {
		t.Fatalf("the box's env.json was overridden: %q", v)
	}
	if err := b.Locations.SetLocalConfig("hello", RepoConfig{Env: map[string]string{AgentBrowserIdleEnv: "0"}}); err != nil {
		t.Fatal(err)
	}
	if v := valueIn(wt.Path, inWorktree); v != "0" {
		t.Fatalf("the project's env was overridden: %q", v)
	}
}

// A fake agent-browser, run from the test binary under that name. As the
// real one: `daemon` (which agent-browser starts with AGENT_BROWSER_DAEMON=1
// in its own session) makes a throwaway profile and a "chrome" child,
// listens on <socket dir>/<session>.sock, and on a close request stops its
// child, removes the profile and exits; `--session S close` asks it to.
const fakeAgentBrowserEnv = "BERTH_TEST_FAKE_AGENT_BROWSER"

func init() {
	if os.Getenv(fakeAgentBrowserEnv) == "1" {
		os.Exit(fakeAgentBrowser(os.Args[1:]))
	}
}

func fakeAgentBrowser(args []string) int {
	session := os.Getenv("AGENT_BROWSER_SESSION")
	if len(args) >= 2 && args[0] == "--session" {
		session, args = args[1], args[2:]
	}
	if session == "" {
		session = "default"
	}
	sock := filepath.Join(os.Getenv("FAKE_SOCKET_DIR"), session+".sock")
	switch {
	case len(args) == 1 && args[0] == "close":
		if f := os.Getenv("FAKE_CLOSE_LOG"); f != "" {
			line := session + " daemon=" + os.Getenv("AGENT_BROWSER_DAEMON") + " berth=" + os.Getenv("BERTH_SESSION") + "\n"
			if fh, err := os.OpenFile(f, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600); err == nil {
				fh.WriteString(line)
				fh.Close()
			}
		}
		c, err := net.Dial("unix", sock)
		if err != nil {
			return 1
		}
		c.Write([]byte("close\n"))
		bufio.NewReader(c).ReadString('\n')
		return 0
	case len(args) == 1 && args[0] == "daemon":
		profile := os.Getenv("FAKE_PROFILE")
		os.MkdirAll(profile, 0o700)
		// The browser is another program, whatever this one is called.
		self, _ := os.Executable()
		if r, err := filepath.EvalSymlinks(self); err == nil {
			self = r
		}
		chrome := exec.Command(self, "chrome", "--user-data-dir="+profile)
		if err := chrome.Start(); err != nil {
			return 1
		}
		ln, err := net.Listen("unix", sock)
		if err != nil {
			return 1
		}
		if os.Getenv("FAKE_IGNORE_TERM") == "1" {
			signal.Ignore(syscall.SIGTERM)
		}
		for {
			c, err := ln.Accept()
			if err != nil {
				return 1
			}
			bufio.NewReader(c).ReadString('\n')
			if os.Getenv("FAKE_IGNORE_CLOSE") == "1" {
				c.Close()
				continue
			}
			chrome.Process.Kill()
			chrome.Wait()
			os.RemoveAll(profile)
			c.Write([]byte("ok\n"))
			c.Close()
			ln.Close()
			return 0
		}
	case len(args) >= 1 && args[0] == "chrome":
		if os.Getenv("FAKE_IGNORE_TERM") == "1" {
			signal.Ignore(syscall.SIGTERM)
		}
		time.Sleep(time.Hour)
		return 0
	}
	return 2
}

type fakeAB struct {
	t       *testing.T
	bin     string
	sockDir string
	log     string
	tmp     string
}

func newFakeAB(t *testing.T) *fakeAB {
	t.Helper()
	if runtime.GOOS != "linux" && runtime.GOOS != "darwin" {
		t.Skip("berth reads other processes' environment only on Linux and macOS")
	}
	// Unix socket paths are short; t.TempDir is long on macOS.
	tmp, err := os.MkdirTemp("/tmp", "ab")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(tmp) })
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	bin := filepath.Join(tmp, "agent-browser-linux-x64")
	if err := os.Symlink(self, bin); err != nil {
		t.Fatal(err)
	}
	return &fakeAB{t: t, bin: bin, sockDir: tmp, log: filepath.Join(tmp, "close.log"), tmp: tmp}
}

// start runs a fake daemon as agent-browser does, with env (the agent's),
// and waits until its browser runs. It returns the daemon's pid and its
// profile folder.
func (f *fakeAB) start(session string, env ...string) (int, string) {
	f.t.Helper()
	profile := filepath.Join(f.tmp, "agent-browser-chrome-"+session)
	cmd := exec.Command(f.bin, "daemon")
	cmd.Env = append([]string{
		fakeAgentBrowserEnv + "=1", "AGENT_BROWSER_DAEMON=1", "AGENT_BROWSER_SESSION=" + session,
		"FAKE_SOCKET_DIR=" + f.sockDir, "FAKE_PROFILE=" + profile, "FAKE_CLOSE_LOG=" + f.log, "PATH=/usr/bin:/bin",
	}, env...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		f.t.Fatal(err)
	}
	go cmd.Wait()
	f.t.Cleanup(func() {
		// Whatever a test left: the daemon's group, its child with it.
		for _, p := range f.procsOf(cmd.Process.Pid) {
			syscall.Kill(p, syscall.SIGKILL)
		}
	})
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(filepath.Join(f.sockDir, session+".sock")); err == nil && len(f.procsOf(cmd.Process.Pid)) == 2 {
			return cmd.Process.Pid, profile
		}
		time.Sleep(50 * time.Millisecond)
	}
	f.t.Fatalf("fake agent-browser %s never started", session)
	return 0, ""
}

// procsOf is the daemon and its children that still run.
func (f *fakeAB) procsOf(daemon int) []int {
	ps, err := scanProcs(fakeAgentBrowserEnv + "=")
	if err != nil {
		f.t.Fatal(err)
	}
	var out []int
	for _, p := range ps {
		if p.PID == daemon || p.PPID == daemon {
			out = append(out, p.PID)
		}
	}
	return out
}

// Reaping closes the agent-browser sessions of berth sessions that ended,
// with agent-browser's own close first and signals for one that won't, and
// leaves alone those of running sessions, those run by hand (no
// BERTH_SESSION) and those from another tmux server.
func TestReapClosesOnlyEndedBerthSessionsAgentBrowsers(t *testing.T) {
	f := newFakeAB(t)
	ours := "TMUX=/tmp/tmux-test/berth," + strconv.Itoa(deadPID(t)) + ",0"
	gone, goneProfile := f.start("gone", "BERTH_SESSION=task-gone", ours)
	stubborn, stubbornProfile := f.start("stubborn", "BERTH_SESSION=task-stubborn", ours, "FAKE_IGNORE_CLOSE=1", "FAKE_IGNORE_TERM=1")
	alive, aliveProfile := f.start("alive", "BERTH_SESSION=task-alive", ours)
	byHand, _ := f.start("byhand", ours)
	other, _ := f.start("other", "BERTH_SESSION=task-gone", "TMUX=/tmp/tmux-test/someone-else,1,0")

	a := &AgentBrowsers{
		Socket: "/tmp/tmux-test/berth",
		Live: func(context.Context) (map[string]bool, error) {
			return map[string]bool{"task-alive": true}, nil
		},
		grace: 500 * time.Millisecond,
	}
	all, err := a.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, s := range all {
		if s.Daemon == 0 || len(s.PIDs) != 2 || len(s.Profiles) != 1 {
			t.Fatalf("%+v: want its daemon first, its chrome, and its profile", s)
		}
		names = append(names, s.BerthSession+"/"+s.Session+"/"+map[bool]string{true: "live", false: "ended"}[s.Live])
	}
	if want := []string{"task-alive/alive/live", "task-gone/gone/ended", "task-stubborn/stubborn/ended"}; !slices.Equal(names, want) {
		t.Fatalf("listed %v, want %v", names, want)
	}

	done, err := a.Reap(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(done) != 2 || done[0].ClosedBy != "agent-browser close" || done[1].ClosedBy != "SIGKILL" {
		t.Fatalf("reaped %+v", done)
	}
	for _, d := range []int{gone, stubborn} {
		if left := f.procsOf(d); len(left) != 0 {
			t.Fatalf("daemon %d: %v still run", d, left)
		}
	}
	for _, d := range []int{alive, byHand, other} {
		if left := f.procsOf(d); len(left) != 2 {
			t.Fatalf("daemon %d was touched: %v left", d, left)
		}
	}
	for _, p := range []string{goneProfile, stubbornProfile} {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Fatalf("profile %s is still there", p)
		}
	}
	if _, err := os.Stat(aliveProfile); err != nil {
		t.Fatalf("a running session's profile went: %v", err)
	}
	log, _ := os.ReadFile(f.log)
	// close ran for both, as their agent would, without the daemon's mark.
	if got := string(log); !strings.Contains(got, "gone daemon= berth=task-gone\n") || !strings.Contains(got, "stubborn daemon= berth=task-stubborn\n") {
		t.Fatalf("close log:\n%s", got)
	}

	// The session that ran ends now, the last one, and its tmux server
	// with it: Reap for it alone takes only its own.
	a.Live = func(context.Context) (map[string]bool, error) { return map[string]bool{}, nil }
	if done, err := a.Reap(context.Background(), "task-alive"); err != nil || len(done) != 1 {
		t.Fatalf("Reap(task-alive) = %+v, %v", done, err)
	}
	if left := f.procsOf(alive); len(left) != 0 {
		t.Fatalf("task-alive's agent-browser still runs: %v", left)
	}
	for _, d := range []int{byHand, other} {
		if left := f.procsOf(d); len(left) != 2 {
			t.Fatalf("daemon %d was touched: %v left", d, left)
		}
	}
}

// Stopping a berth session pokes the reaper, which closes what the session
// left at once instead of within the minute.
func TestStoppingASessionReapsItsAgentBrowsers(t *testing.T) {
	f := newFakeAB(t)
	s := testSessions(t)
	a := NewAgentBrowsers(s)
	a.grace = 500 * time.Millisecond
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ctxRun, stop := context.WithCancel(ctx)
	defer stop()
	ready := make(chan struct{})
	a.Live = func(c context.Context) (map[string]bool, error) {
		select {
		case <-ready:
		default:
			close(ready)
		}
		return s.live(c)
	}
	if _, err := s.Create(ctx, "agent1", "", t.TempDir(), "sleep 600", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Create(ctx, "agent2", "", t.TempDir(), "sleep 600", nil); err != nil {
		t.Fatal(err)
	}
	server, err := s.tmux(ctx, "display-message", "-p", "-t", "=agent1:", "#{pid}")
	if err != nil {
		t.Fatal(err)
	}
	// What the agent's agent-browser would carry: its session's TMUX.
	daemon, _ := f.start("work", "BERTH_SESSION=agent1", "TMUX="+a.Socket+","+strings.TrimSpace(string(server))+",0")
	go a.Run(ctxRun, t.Logf)
	<-ready
	time.Sleep(200 * time.Millisecond)
	if left := f.procsOf(daemon); len(left) != 2 {
		t.Fatalf("a running session's agent-browser was touched: %v", left)
	}
	if err := s.Kill(ctx, "agent1"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for len(f.procsOf(daemon)) > 0 {
		if time.Now().After(deadline) {
			t.Fatalf("still running after the session stopped: %v", f.procsOf(daemon))
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// deadPID is the id of a process that has ended.
func deadPID(t *testing.T) int {
	t.Helper()
	cmd := exec.Command("true")
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}
	return cmd.Process.Pid
}

// tmux listing no sessions while its server runs (a listing that went
// wrong) closes nothing.
func TestAnEmptyListingFromARunningTmuxClosesNothing(t *testing.T) {
	procs := []proc{{PID: 10, Exe: "/x/agent-browser", Env: map[string]string{"AGENT_BROWSER_DAEMON": "1", "BERTH_SESSION": "task", "TMUX": "/tmp/tmux-1/berth," + strconv.Itoa(os.Getpid()) + ",0"}}}
	a := &AgentBrowsers{Socket: "/tmp/tmux-1/berth", scan: func() ([]proc, error) { return procs, nil },
		Live:     func(context.Context) (map[string]bool, error) { return map[string]bool{}, nil },
		closeCmd: func(context.Context, AgentBrowserSession) error { t.Fatal("closed"); return nil },
		signal:   func(int, syscall.Signal) error { t.Fatal("signalled"); return nil }}
	if done, err := a.Reap(context.Background(), ""); err != nil || len(done) != 0 {
		t.Fatalf("Reap = %+v, %v", done, err)
	}
	procs[0].Env["TMUX"] = "/tmp/tmux-1/berth," + strconv.Itoa(deadPID(t)) + ",0"
	if all, _ := a.List(context.Background()); len(all) != 1 || all[0].Live {
		t.Fatalf("with its server gone: %+v", all)
	}
}

// A session whose program exited stays listed (its last output is kept)
// but no longer counts as running, so what it left is closed.
func TestAnExitedSessionIsNotLive(t *testing.T) {
	s := testSessions(t)
	ctx := context.Background()
	for _, c := range []struct{ name, cmd string }{{"runs", "sleep 600"}, {"exits", "true"}} {
		if _, err := s.Create(ctx, c.name, "", t.TempDir(), c.cmd, nil); err != nil {
			t.Fatal(err)
		}
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		live, err := s.live(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if live["runs"] && !live["exits"] {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("live = %v", live)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if _, err := s.Get(ctx, "exits"); err != nil {
		t.Fatalf("the exited session is gone from the list: %v", err)
	}
}

func TestDoctorReportsOrphanedAgentBrowsers(t *testing.T) {
	procs := []proc{
		{PID: 10, Exe: "/home/u/.npm/_npx/x/node_modules/agent-browser/bin/agent-browser-linux-x64", Env: map[string]string{"AGENT_BROWSER_DAEMON": "1", "BERTH_SESSION": "old-task", "AGENT_BROWSER_SESSION": "qa", "TMUX": "/tmp/tmux-1/berth,1,0"}},
		{PID: 11, PPID: 10, Exe: "/opt/chrome", Args: []string{"/opt/chrome", "--user-data-dir=/tmp/agent-browser-chrome-1234"}, Env: map[string]string{"AGENT_BROWSER_DAEMON": "1", "BERTH_SESSION": "old-task", "AGENT_BROWSER_SESSION": "qa", "TMUX": "/tmp/tmux-1/berth,1,0"}},
		{PID: 20, Exe: "/usr/bin/agent-browser", Env: map[string]string{"AGENT_BROWSER_DAEMON": "1", "BERTH_SESSION": "live-task", "TMUX": "/tmp/tmux-1/berth,1,0"}},
		{PID: 30, Exe: "/usr/bin/agent-browser", Env: map[string]string{"AGENT_BROWSER_DAEMON": "1"}},
	}
	live := map[string]bool{"live-task": true}
	b := &Box{AgentBrowsers: &AgentBrowsers{Socket: "/tmp/tmux-1/berth", scan: func() ([]proc, error) { return procs, nil },
		Live: func(context.Context) (map[string]bool, error) { return live, nil }}}
	c, ok := b.agentBrowserCheck(context.Background())
	if !ok || c.Status != doctor.Warn || c.Fix != "berthd browser reap" || !strings.Contains(c.Detail, `"qa" of old-task (daemon 10, 2 processes)`) || strings.Contains(c.Detail, "live-task") {
		t.Fatalf("check = %+v", c)
	}
	live["old-task"] = true
	if c, _ := b.agentBrowserCheck(context.Background()); c.Status != doctor.OK || !strings.Contains(c.Detail, "2 open") {
		t.Fatalf("with every session running: %+v", c)
	}
	procs = nil
	if c, _ := b.agentBrowserCheck(context.Background()); c.Status != doctor.OK || c.Detail != "none left behind" {
		t.Fatalf("with none: %+v", c)
	}
	if _, ok := (&Box{}).agentBrowserCheck(context.Background()); ok {
		t.Fatal("a box that doesn't watch agent-browser reported on it")
	}
}

func TestBrowserReapAPI(t *testing.T) {
	procs := []proc{
		{PID: 10, Exe: "/x/agent-browser", Env: map[string]string{"AGENT_BROWSER_DAEMON": "1", "BERTH_SESSION": "old-task", "TMUX": "/tmp/tmux-1/berth,1,0"}},
		{PID: 20, Exe: "/x/agent-browser", Env: map[string]string{"AGENT_BROWSER_DAEMON": "1", "BERTH_SESSION": "live-task", "TMUX": "/tmp/tmux-1/berth,1,0"}},
	}
	var closed, signalled []int
	a := &AgentBrowsers{Socket: "/tmp/tmux-1/berth", grace: 10 * time.Millisecond,
		scan: func() ([]proc, error) { return procs, nil },
		Live: func(context.Context) (map[string]bool, error) { return map[string]bool{"live-task": true}, nil },
		closeCmd: func(_ context.Context, s AgentBrowserSession) error {
			closed = append(closed, s.Daemon)
			procs = slices.DeleteFunc(procs, func(p proc) bool { return p.PID == s.Daemon })
			return nil
		},
		signal: func(pid int, _ syscall.Signal) error { signalled = append(signalled, pid); return nil },
	}
	b := &Box{AgentBrowsers: a}
	call := func(body string) map[string]any {
		rec := httptest.NewRecorder()
		if err := b.browserReap(rec, httptest.NewRequest("POST", "/v1/browser/reap", strings.NewReader(body))); err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		json.Unmarshal(rec.Body.Bytes(), &out)
		return out
	}
	out := call(`{"dry_run":true}`)
	if len(closed) != 0 || !strings.Contains(out["text"].(string), `1 agent-browser session left by ended berth sessions:`) || !strings.Contains(out["text"].(string), "old-task") {
		t.Fatalf("dry run: %v, closed %v", out, closed)
	}
	out = call(`{}`)
	if !slices.Equal(closed, []int{10}) || len(signalled) != 0 || !strings.HasPrefix(out["text"].(string), "Closed 1 agent-browser session") {
		t.Fatalf("reap: %v, closed %v, signalled %v", out, closed, signalled)
	}
	if out := call(``); out["text"] != "No agent-browser sessions left by ended berth sessions." {
		t.Fatalf("again: %v", out)
	}
}

func TestSameSocket(t *testing.T) {
	for _, c := range []struct {
		tmux, path string
		want       bool
	}{
		{"/tmp/tmux-501/berth,123,0", "/tmp/tmux-501/berth", true},
		{"/tmp/tmux-501/default,123,0", "/tmp/tmux-501/berth", false},
		{"", "/tmp/tmux-501/berth", false},
		{"/tmp/tmux-501/berth,1,0", "", false},
	} {
		if got := sameSocket(c.tmux, c.path); got != c.want {
			t.Errorf("sameSocket(%q, %q) = %v", c.tmux, c.path, got)
		}
	}
	if runtime.GOOS == "darwin" {
		// /tmp is a link to /private/tmp, which tmux names.
		dir, err := os.MkdirTemp("/tmp", "sock")
		if err != nil {
			t.Fatal(err)
		}
		defer os.RemoveAll(dir)
		if !sameSocket("/private"+dir+"/berth,1,0", dir+"/berth") {
			t.Error("/private/tmp and /tmp differ")
		}
	}
}
