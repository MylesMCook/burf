package inventory

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"text/template"
	"time"
	"unicode/utf16"
)

func TestParseServiceSources(t *testing.T) {
	systemd := parseSystemd([]byte("Id=worker.service\nDescription=Worker\nActiveState=active\nSubState=running\nMainPID=42\n\nId=failed.service\nActiveState=failed\nMainPID=0\n"), "systemd-user")
	if systemd.State != "ok" || len(systemd.Services) != 2 || systemd.Services[0].PID != 42 || systemd.Services[1].State != "failed" {
		t.Fatalf("systemd: %#v", systemd)
	}
	launchd := parseLaunchd([]byte("system = {\n services = {\n 42 - com.test.worker\n 0 9 com.test.failed\n 0 - com.test.idle\n }\n environment = { SECRET=value }\n}"), "launchd-system")
	if launchd.State != "ok" || len(launchd.Services) != 3 || launchd.Services[0].State != "running" || launchd.Services[1].State != "failed" || launchd.Services[2].State != "stopped" {
		t.Fatalf("launchd: %#v", launchd)
	}
	windows := parseWindows([]byte(`{"services":[{"key":"Spooler","name":"Print spooler","state":"Running","pid":42,"started":"2026-10-11T01:00:00.0000000Z"},{"key":"\\Jobs\\Daily","name":"Daily","state":"Ready"}],"partial":false}`), "windows-services")
	if windows.State != "ok" || len(windows.Services) != 2 || windows.Services[0].State != "running" || windows.Services[1].State != "stopped" {
		t.Fatalf("windows: %#v", windows)
	}
}

func TestMalformedSourcesNeverClaimComplete(t *testing.T) {
	for name, c := range map[string]Collection{"systemd": parseSystemd([]byte("unexpected garbage"), "systemd-user"), "launchd": parseLaunchd([]byte("permission denied"), "launchd-system"), "windows": parseWindows([]byte(`{"services":`), "windows-services")} {
		if c.State == "ok" {
			t.Errorf("%s falsely complete: %#v", name, c)
		}
	}
	partial := parseWindows([]byte(`{"services":[{"key":"ok","name":"OK","state":"Running"}],"partial":true}`), "windows-services")
	if partial.State != "partial" || len(partial.Services) != 1 {
		t.Fatalf("partial lost: %#v", partial)
	}
}

func TestCorrelateRequiresProcessStart(t *testing.T) {
	input := []Collection{{Coverage: Coverage{Source: "systemd-user", State: "ok"}, Services: []Service{{Key: "test.service", State: "running", PID: 42, ProcessStarted: "first", Ports: []int{8000}}}}, {Coverage: Coverage{Source: "listeners", State: "ok"}, Services: []Service{{Key: "42/first", PID: 42, ProcessStarted: "first", Ports: []int{3000, 8000}}, {Key: "42/second", PID: 42, ProcessStarted: "second", Ports: []int{4000}}}}}
	got := Correlate(input)
	if len(got[1].Services) != 1 || got[1].Services[0].ProcessStarted != "second" || len(got[0].Services[0].Ports) != 2 {
		t.Fatalf("correlation %#v", got)
	}
}

func TestDockerRejectsRemoteContext(t *testing.T) {
	calls := 0
	run := func(ctx context.Context, name string, args ...string) ([]byte, error) {
		calls++
		if calls > 1 {
			t.Fatalf("contacted engine: %s %v", name, args)
		}
		return []byte("ssh://someone@private-host\n"), nil
	}
	got := (&collector{run: run, goos: "linux"}).docker(context.Background())
	if got.State != "unavailable" || strings.Contains(got.Error, "private-host") || calls != 1 {
		t.Fatalf("remote context: %#v, calls %d", got, calls)
	}
}

func TestDockerContainerIdentityAndHealth(t *testing.T) {
	got := parseDocker([]byte("{\"id\":\"0123456789abcdef\",\"name\":\"/worker\",\"state\":\"running\",\"health\":\"healthy\",\"pid\":42,\"started\":\"first\",\"ports\":{\"80/tcp\":[{\"HostPort\":\"8080\"}]},\"project\":\"demo\"}\n{\"id\":\"different\",\"name\":\"/worker\",\"state\":\"exited\",\"ports\":{}}\n"))
	if got.State != "ok" || len(got.Services) != 2 || got.Services[0].Key == got.Services[1].Key || got.Services[0].Health != "healthy" || len(got.Services[0].Ports) != 1 || got.Services[0].Ports[0] != 8080 {
		t.Fatalf("containers: %#v", got)
	}
}

func TestSSHSafetyAndSanitizedFailure(t *testing.T) {
	for _, target := range []string{"-oProxyCommand=evil", "host; touch file", "user@host\n"} {
		called := false
		got := CollectWithRunner(context.Background(), "linux", target, func(context.Context, string, ...string) ([]byte, error) { called = true; return nil, nil })
		if called || len(got) != 1 || got[0].State != "error" {
			t.Fatalf("invalid target %q: %#v", target, got)
		}
	}
	calls := 0
	got := CollectWithRunner(context.Background(), "", "good-host", func(_ context.Context, name string, args ...string) ([]byte, error) {
		calls++
		joined := strings.Join(args, " ")
		if name != "ssh" || !strings.Contains(joined, "StrictHostKeyChecking=yes") || !strings.Contains(joined, "BatchMode=yes") || !strings.Contains(joined, "ConnectTimeout=5") || !strings.Contains(joined, "ClearAllForwardings=yes") || !strings.Contains(joined, "PermitLocalCommand=no") {
			t.Fatalf("unsafe SSH %s %v", name, args)
		}
		return nil, errors.New("HOST KEY FAILED token=secret-value")
	})
	if len(got) != 1 || got[0].State == "ok" || strings.Contains(got[0].Error, "secret-value") || calls > 2 {
		t.Fatalf("SSH failure: %#v calls=%d", got, calls)
	}
}

func TestMissingToolsAndCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	got := CollectWithRunner(ctx, "linux", "", func(ctx context.Context, _ string, _ ...string) ([]byte, error) { return nil, ctx.Err() })
	for _, c := range got {
		if c.State == "ok" || strings.Contains(c.Error, "secret") {
			t.Fatalf("cancelled: %#v", c)
		}
	}
	missing := (&collector{run: func(context.Context, string, ...string) ([]byte, error) { return nil, exec.ErrNotFound }, goos: "linux"}).docker(context.Background())
	if missing.State != "unavailable" {
		t.Fatalf("missing docker: %#v", missing)
	}
}

func TestProcessIdentityChangesWithStart(t *testing.T) {
	processes, bad := parseProcesses([]byte("42 Sun Oct 11 01:02:03 2026 /usr/bin/worker\n43 Sun Oct 11 01:02:04 2026 /usr/bin/other\n"))
	if bad || processes[42].name != "worker" || processes[42].started == "" {
		t.Fatalf("processes %#v bad=%v", processes, bad)
	}
	got := parseLsof([]byte("p42\ncworker\nn127.0.0.1:3000\np43\ncother\nn[::1]:4000\n"), processes)
	if got.State != "ok" || len(got.Services) != 2 || got.Services[0].Key == got.Services[1].Key {
		t.Fatalf("listeners %#v", got)
	}
	previous := got.Services[0].Key
	p := processes[42]
	p.started = "later"
	processes[42] = p
	changed := parseLsof([]byte("p42\ncworker\nn127.0.0.1:3000\n"), processes)
	if changed.Services[0].Key == previous {
		t.Fatal("PID reuse kept old identity")
	}
}

func TestLinuxCollectionPreservesCoverageAndCorrelatesPorts(t *testing.T) {
	run := func(_ context.Context, name string, args ...string) ([]byte, error) {
		joined := strings.Join(args, " ")
		switch {
		case name == "sh" && strings.Contains(joined, "/proc/"):
			return []byte("42\tboot-one/1000\tworker\n"), nil
		case name == "systemctl" && strings.Contains(joined, "--user"):
			return []byte("Id=worker.service\nDescription=Worker\nActiveState=active\nSubState=running\nMainPID=42\n"), nil
		case name == "systemctl":
			return nil, errors.New("denied with secret=private")
		case name == "ss":
			return []byte(`LISTEN 0 100 127.0.0.1:3000 0.0.0.0:* users:(("worker",pid=42,fd=8))` + "\n"), nil
		case name == "docker" && strings.Contains(joined, "context inspect"):
			return []byte("unix:///var/run/docker.sock\n"), nil
		case name == "docker" && strings.Contains(joined, "--host unix:///var/run/docker.sock container ls"):
			return nil, nil
		default:
			t.Fatalf("unexpected query %s %v", name, args)
			return nil, nil
		}
	}
	got := CollectWithRunner(context.Background(), "linux", "", run)
	bySource := map[string]Collection{}
	for _, c := range got {
		bySource[c.Source] = c
	}
	if bySource["systemd-system"].State != "error" || strings.Contains(bySource["systemd-system"].Error, "private") {
		t.Fatalf("failure coverage %#v", got)
	}
	worker := bySource["systemd-user"].Services[0]
	if worker.ProcessStarted != "boot-one/1000" || len(worker.Ports) != 1 || worker.Ports[0] != 3000 || worker.ObservedAt.IsZero() {
		t.Fatalf("worker %#v", worker)
	}
	if len(bySource["listeners"].Services) != 0 || bySource["listeners"].State != "ok" || bySource["docker"].State != "ok" {
		t.Fatalf("correlation coverage %#v", got)
	}
}

func TestSSHWindowsUsesEncodedCommandForCmdAndPowerShell(t *testing.T) {
	calls := 0
	run := func(_ context.Context, name string, args ...string) ([]byte, error) {
		calls++
		if name != "ssh" {
			t.Fatalf("not ssh: %s", name)
		}
		command := args[len(args)-1]
		if calls == 1 {
			if !strings.Contains(command, "uname") {
				t.Fatalf("OS probe: %s", command)
			}
			return nil, errors.New("not unix")
		}
		if !strings.HasPrefix(command, "powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ") {
			t.Fatalf("shell-dependent command: %s", command)
		}
		encoded := command[strings.LastIndex(command, " ")+1:]
		data, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			t.Fatal(err)
		}
		units := make([]uint16, len(data)/2)
		for i := range units {
			units[i] = binary.LittleEndian.Uint16(data[i*2:])
		}
		script := string(utf16.Decode(units))
		if strings.Contains(script, "[Console]::Write('Windows')") {
			return []byte("Windows"), nil
		}
		if strings.Contains(script, "DOCKER_HOST") {
			return []byte("tcp://remote-engine:2376"), nil
		}
		return []byte(`{"services":[],"partial":false}`), nil
	}
	got := CollectWithRunner(context.Background(), "", "windows-host", run)
	if len(got) != 4 || calls != 6 {
		t.Fatalf("Windows sources: %#v calls %d", got, calls)
	}
	for _, c := range got {
		if c.Source == "docker" && c.State != "unavailable" {
			t.Fatalf("remote engine %#v", c)
		}
		if c.Source != "docker" && c.State != "ok" {
			t.Fatalf("Windows coverage %#v", c)
		}
	}
}

func TestListenerPermissionGapNeverCompletesSnapshot(t *testing.T) {
	col := parseSS([]byte("LISTEN 0 100 *:3000 *:*\n"), map[int]processIdentity{})
	if col.State == "ok" || len(col.Services) != 0 {
		t.Fatalf("inaccessible owner: %#v", col)
	}
	col = parseLsof([]byte("p42\ncworker\nf8\nn*:3000\n"), map[int]processIdentity{42: {name: "worker", started: "now"}})
	if col.State != "ok" || len(col.Services) != 1 {
		t.Fatalf("mandatory lsof descriptors: %#v", col)
	}
}

func TestOutputLimitAndDeadline(t *testing.T) {
	var out cappedOutput
	if _, err := out.Write(make([]byte, maxCollectorOutput+1)); !errors.Is(err, errOutputLimit) || out.Len() != 0 {
		t.Fatalf("output not bounded: len %d err %v", out.Len(), err)
	}
	c := &collector{run: func(ctx context.Context, _ string, _ ...string) ([]byte, error) {
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > collectorTimeout {
			t.Fatal("query has no bounded deadline")
		}
		return nil, context.DeadlineExceeded
	}, goos: "linux"}
	data, err := c.query(context.Background(), "fake")
	col := c.finish(context.Background(), parseSystemd(data, "systemd-user"), err)
	if col.State == "ok" || !strings.Contains(col.Error, "timed out") {
		t.Fatalf("timeout coverage: %#v", col)
	}
}

func TestDockerProjectionHandlesAbsentHealthWithoutSecrets(t *testing.T) {
	tmpl, err := template.New("docker").Option("missingkey=error").Funcs(template.FuncMap{"json": func(v any) string { data, _ := json.Marshal(v); return string(data) }}).Parse(dockerInspectTemplate)
	if err != nil {
		t.Fatal(err)
	}
	row := map[string]any{"Id": strings.Repeat("a", 64), "Name": "/worker", "State": map[string]any{"Status": "running", "Pid": 42, "StartedAt": "now"}, "NetworkSettings": map[string]any{"Ports": nil}, "Config": map[string]any{"Labels": nil, "Env": []string{"SECRET=private"}, "Cmd": []string{"secret-command"}}}
	var out bytes.Buffer
	if err := tmpl.Execute(&out, row); err != nil {
		t.Fatal(err)
	}
	col := parseDocker(out.Bytes())
	if col.State != "ok" || len(col.Services) != 1 || col.Services[0].Health != "" || strings.Contains(out.String(), "private") || strings.Contains(out.String(), "secret-command") {
		t.Fatalf("unsafe/incomplete Docker projection: %#v", col)
	}
}

func TestLocalWindowsDockerUsesDirectBoundedProcess(t *testing.T) {
	calls := 0
	c := &collector{goos: "windows", run: func(ctx context.Context, name string, args ...string) ([]byte, error) {
		calls++
		if name != "docker" || len(args) < 4 || args[0] != "--host" || args[1] != "npipe:////./pipe/docker_engine" {
			t.Fatalf("local Docker must run directly: %s %v", name, args)
		}
		if _, ok := ctx.Deadline(); !ok {
			t.Fatal("Docker query has no deadline")
		}
		return nil, nil
	}}
	for _, args := range [][]string{{"container", "ls", "--all"}, {"container", "inspect", "--format", dockerInspectTemplate, strings.Repeat("a", 64)}} {
		if _, err := c.dockerCommand(context.Background(), "npipe:////./pipe/docker_engine", args...); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 2 {
		t.Fatalf("calls=%d", calls)
	}
}

func TestCollectorDockerEnvironmentIsolation(t *testing.T) {
	dir := t.TempDir()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(exe)
	if err != nil {
		t.Fatal(err)
	}
	filename := "docker"
	if runtime.GOOS == "windows" {
		filename += ".exe"
	}
	if err := os.WriteFile(filepath.Join(dir, filename), data, 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("DOCKER_CONTEXT", "synthetic-remote-context")
	t.Setenv("Docker_Host", "tcp://synthetic-remote:2375")
	t.Setenv("INVENTORY_ENV_FIXTURE", "check")
	out, err := runCollector(context.Background(), "docker", "-test.run=^TestCollectorEnvironmentFixture$", "--", "--host", "unix:///synthetic.sock")
	if err != nil || string(out) != "clean" {
		t.Fatalf("explicit local host inherited context: output %q err %v", out, err)
	}
	out, err = runCollector(context.Background(), "docker", "-test.run=^TestCollectorEnvironmentFixture$", "--")
	if err != nil || string(out) != "inherited" {
		t.Fatalf("unrelated environment selection changed: output %q err %v", out, err)
	}
	t.Setenv("INVENTORY_ENV_FIXTURE", "wait")
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	started := time.Now()
	_, err = runCollector(ctx, "docker", "-test.run=^TestCollectorEnvironmentFixture$", "--", "--host", "unix:///synthetic.sock")
	if !errors.Is(err, context.DeadlineExceeded) || time.Since(started) > time.Second {
		t.Fatalf("direct Docker timeout failed: %v", err)
	}
}

func TestCollectorEnvironmentFixture(t *testing.T) {
	mode := os.Getenv("INVENTORY_ENV_FIXTURE")
	if mode == "" {
		return
	}
	if mode == "wait" {
		<-time.After(time.Hour)
		os.Exit(0)
	}
	for _, entry := range os.Environ() {
		key, _, _ := strings.Cut(entry, "=")
		if strings.EqualFold(key, "DOCKER_CONTEXT") || strings.EqualFold(key, "DOCKER_HOST") {
			fmt.Print("inherited")
			os.Exit(0)
		}
	}
	fmt.Print("clean")
	os.Exit(0)
}
