package main

import (
	"context"
	"errors"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/MylesMCook/burf/internal/agent"
)

type stopClient struct {
	running bool
	info    agent.AgentInfo
	infoErr error
	stopErr error
	waitErr error
	steps   *[]string
}

func TestRunningAgentOwnershipRequiresItsExecutableIdentity(t *testing.T) {
	program := filepath.Join(t.TempDir(), "berth-cli.exe")
	for _, tc := range []struct {
		name string
		exe  string
		err  error
		want bool
	}{
		{"same executable", program, nil, true},
		{"other executable", filepath.Join(filepath.Dir(program), "other.exe"), nil, false},
		{"missing identity", "", nil, false},
		{"failed query", program, errors.New("unreachable"), false},
		{"case rules", strings.ToUpper(program), nil, runtime.GOOS == "windows"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			steps := []string{}
			c := stopClient{info: agent.AgentInfo{Exe: tc.exe}, infoErr: tc.err, steps: &steps}
			if got := ownsRunningAgent(context.Background(), c, program); got != tc.want {
				t.Fatalf("owned = %v, want %v", got, tc.want)
			}
		})
	}
}

func (c stopClient) Running(context.Context) bool { return c.running }
func (c stopClient) Info(context.Context) (agent.AgentInfo, error) {
	*c.steps = append(*c.steps, "info")
	return c.info, c.infoErr
}
func (c stopClient) Stop(context.Context) error {
	*c.steps = append(*c.steps, "stop")
	return c.stopErr
}
func (c stopClient) StopDrained(context.Context) error {
	*c.steps = append(*c.steps, "drain")
	return c.stopErr
}
func (c stopClient) WaitStopped(context.Context, string) error {
	*c.steps = append(*c.steps, "lock")
	return c.waitErr
}

func TestStopDrainedWaitsForActualProcessExitAfterLockRelease(t *testing.T) {
	for _, drain := range []bool{false, true} {
		steps := []string{}
		old := agentProcessWaiter
		agentProcessWaiter = func(pid int) (func(context.Context) error, func(), error) {
			if pid != 123 {
				t.Fatalf("PID = %d", pid)
			}
			steps = append(steps, "open")
			return func(context.Context) error { steps = append(steps, "exit"); return nil }, func() { steps = append(steps, "close") }, nil
		}
		c := stopClient{running: true, info: agent.AgentInfo{PID: 123}, steps: &steps}
		stopped, err := stopAgentClient(context.Background(), c, t.TempDir(), drain)
		agentProcessWaiter = old
		operation := "stop"
		if drain {
			operation = "drain"
		}
		if err != nil || !stopped || !reflect.DeepEqual(steps, []string{"info", "open", operation, "lock", "exit", "close"}) {
			t.Fatalf("stopped=%v err=%v steps=%v", stopped, err, steps)
		}
	}
}

func TestStopDrainedProcessTimeoutAbortsWithoutForceOrRestart(t *testing.T) {
	steps := []string{}
	old := agentProcessWaiter
	t.Cleanup(func() { agentProcessWaiter = old })
	agentProcessWaiter = func(int) (func(context.Context) error, func(), error) {
		return func(context.Context) error { steps = append(steps, "exit"); return context.DeadlineExceeded }, func() { steps = append(steps, "close") }, nil
	}
	c := stopClient{running: true, info: agent.AgentInfo{PID: 123}, steps: &steps}
	stopped, err := stopAgentClient(context.Background(), c, t.TempDir(), true)
	if stopped || !errors.Is(err, context.DeadlineExceeded) || !reflect.DeepEqual(steps, []string{"info", "drain", "lock", "exit", "close"}) {
		t.Fatalf("stopped=%v err=%v steps=%v", stopped, err, steps)
	}
}

func TestStopDrainedRequiresProcessHandleBeforeSendingStop(t *testing.T) {
	steps := []string{}
	old := agentProcessWaiter
	t.Cleanup(func() { agentProcessWaiter = old })
	agentProcessWaiter = func(int) (func(context.Context) error, func(), error) { return nil, nil, errors.New("access denied") }
	c := stopClient{running: true, steps: &steps}
	if stopped, err := stopAgentClient(context.Background(), c, t.TempDir(), true); stopped || err == nil || !reflect.DeepEqual(steps, []string{"info"}) {
		t.Fatalf("stopped=%v err=%v steps=%v", stopped, err, steps)
	}
}

func TestStopDrainedDoesNothingWhenAgentIsAbsent(t *testing.T) {
	steps := []string{}
	c := stopClient{steps: &steps}
	if stopped, err := stopAgentClient(context.Background(), c, t.TempDir(), true); stopped || err != nil || len(steps) != 0 {
		t.Fatalf("stopped=%v err=%v steps=%v", stopped, err, steps)
	}
}
