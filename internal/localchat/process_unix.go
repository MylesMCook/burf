//go:build darwin || linux

package localchat

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
)

const ownedHelper = "--burf-owned-codex-app-server"

// The helper remains the process-group leader until cleanup. Its private
// lifeline reaches EOF even if the backend is killed, unlike a parent goroutine.
// Provider children inherit the group but never the lifeline descriptor.
func init() {
	if len(os.Args) != 3 || os.Args[1] != ownedHelper {
		return
	}
	group, err := syscall.Getpgid(0)
	var stat syscall.Stat_t
	if err != nil || group != os.Getpid() || syscall.Fstat(3, &stat) != nil || stat.Mode&syscall.S_IFMT != syscall.S_IFIFO || !filepath.IsAbs(os.Args[2]) {
		os.Exit(125)
	}
	syscall.CloseOnExec(3)
	lifeline := os.NewFile(3, "burf-owner-lifeline")
	stop := func() {
		_ = syscall.Kill(-group, syscall.SIGKILL)
		os.Exit(125)
	}
	go func() { _, _ = io.Copy(io.Discard, lifeline); stop() }()
	cmd := exec.Command(os.Args[2], "app-server", "--listen", "stdio://")
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	_ = cmd.Run()
	stop()
}

type stdioProcess struct {
	input, output, stderr, lifeline *os.File
	once                            sync.Once
	done                            chan struct{}
}

// StartProcess launches a private stdio provider in an owned process group.
// Closing the process or losing its parent kills the group, never another
// application's Codex session. No shell, provider socket or shared daemon is used.
func StartProcess(options LaunchOptions) (_ Process, err error) {
	if !filepath.IsAbs(options.Program) {
		return nil, errors.New("Codex must be an absolute executable path")
	}
	if !filepath.IsAbs(options.CWD) {
		return nil, errors.New("project directory must be absolute")
	}
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	p := &stdioProcess{done: make(chan struct{})}
	var files []*os.File
	defer func() {
		if err != nil {
			for _, f := range files {
				f.Close()
			}
		}
	}()
	pipe := func() (*os.File, *os.File, error) {
		r, w, e := os.Pipe()
		if e == nil {
			files = append(files, r, w)
		}
		return r, w, e
	}
	inR, inW, err := pipe()
	if err != nil {
		return nil, err
	}
	outR, outW, err := pipe()
	if err != nil {
		return nil, err
	}
	errR, errW, err := pipe()
	if err != nil {
		return nil, err
	}
	lifeR, lifeW, err := pipe()
	if err != nil {
		return nil, err
	}
	p.input, p.output, p.stderr, p.lifeline = inW, outR, errR, lifeW
	cmd := exec.Command(exe, ownedHelper, options.Program)
	cmd.Dir, cmd.Env = options.CWD, options.Env
	cmd.Stdin, cmd.Stdout, cmd.Stderr = inR, outW, errW
	cmd.ExtraFiles = []*os.File{lifeR}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err = cmd.Start(); err != nil {
		return nil, fmt.Errorf("start owned Codex app-server: %w", err)
	}
	inR.Close()
	outW.Close()
	errW.Close()
	lifeR.Close()
	go func() { _, _ = io.Copy(io.Discard, p.stderr) }()
	go func() {
		_ = cmd.Wait()
		p.finish()
		close(p.done)
	}()
	return p, nil
}

func (p *stdioProcess) Read(b []byte) (int, error)  { return p.output.Read(b) }
func (p *stdioProcess) Write(b []byte) (int, error) { return p.input.Write(b) }
func (p *stdioProcess) finish() {
	p.once.Do(func() { p.lifeline.Close(); p.input.Close(); p.output.Close(); p.stderr.Close() })
}
func (p *stdioProcess) Close() error { p.finish(); <-p.done; return nil }
