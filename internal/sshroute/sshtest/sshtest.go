// Package sshtest is a stand-in for ssh in tests: a test binary started with
// BERTH_FAKE_SSH=1 acts as `ssh -W ADDR HOST` by connecting to ADDR on this
// computer itself, without SSH, keys or any real host. Tests call
// MaybeRun from TestMain and point the code under test at os.Args[0].
package sshtest

import (
	"fmt"
	"io"
	"net"
	"os"
	"strings"
)

// Env marks a process started as the fake ssh.
const Env = "BERTH_FAKE_SSH"

// LogEnv names a file each run appends its arguments to, one line each.
const LogEnv = "BERTH_FAKE_SSH_LOG"

// Unreachable is a host the fake can't reach, the way ssh fails to.
const Unreachable = "unreachable.invalid"

// MaybeRun acts as ssh, and exits, when this process was started as the
// fake; otherwise it returns at once.
func MaybeRun() {
	if os.Getenv(Env) != "1" {
		return
	}
	os.Exit(run(os.Args[1:]))
}

// Environ is the environment that makes a test binary the fake ssh.
func Environ(log string) []string {
	return []string{Env + "=1", LogEnv + "=" + log}
}

func run(args []string) int {
	if path := os.Getenv(LogEnv); path != "" {
		if f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600); err == nil {
			fmt.Fprintln(f, strings.Join(args, " "))
			f.Close()
		}
	}
	var forward, host string
	for i := 0; i < len(args); i++ {
		switch a := args[i]; a {
		case "-G":
			// What ssh would do: nothing the caller needs to check.
			return 0
		case "-O":
			return 0
		case "-W":
			if i+1 < len(args) {
				forward = args[i+1]
				i++
			}
		case "-o", "-i", "-p", "-l", "-F", "-J":
			i++
		default:
			if !strings.HasPrefix(a, "-") {
				host = a
			}
		}
	}
	if host == Unreachable {
		fmt.Fprintf(os.Stderr, "ssh: Could not resolve hostname %s: nodename nor servname provided, or not known\n", host)
		return 255
	}
	if forward == "" {
		fmt.Fprintln(os.Stderr, "fake ssh: only -W is supported")
		return 255
	}
	c, err := net.Dial("tcp", forward)
	if err != nil {
		fmt.Fprintf(os.Stderr, "channel 0: open failed: connect failed: %v\nstdio forwarding failed\n", err)
		return 255
	}
	done := make(chan struct{}, 2)
	go func() { io.Copy(c, os.Stdin); c.(*net.TCPConn).CloseWrite(); done <- struct{}{} }()
	go func() { io.Copy(os.Stdout, c); done <- struct{}{} }()
	<-done
	return 0
}
