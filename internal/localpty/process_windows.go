package localpty

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
)

const maxUnreadOutput = 1024 * 1024

// Process owns its pseudoconsole and process tree. Call Close when abandoning
// the session. Read must be consumed continuously; exceeding 1 MiB of unread
// output stops the process and reports ErrOutputOverflow instead of losing data.
type Process struct {
	pid            int
	input, output  *os.File
	mu             sync.Mutex
	console, job   windows.Handle
	closeOnce      sync.Once
	closeErr       error
	done, readDone chan struct{}
	waitErr        error
	readMu         sync.Mutex
	readCond       *sync.Cond
	buffer         bytes.Buffer
	readErr        error
}

// Start executes an absolute native executable, without a shell. A nil env
// inherits this process's environment. Other env values replace it entirely.
func Start(program string, args []string, dir string, env []string, cols, rows int) (_ *Process, err error) {
	if err := validSize(cols, rows); err != nil {
		return nil, err
	}
	if !filepath.IsAbs(program) || strings.ContainsAny(program, "\x00\"") {
		return nil, errors.New("terminal executable must be an absolute native executable path")
	}
	app, err := windows.UTF16PtrFromString(program)
	if err != nil {
		return nil, err
	}
	command, err := windows.UTF16PtrFromString(windows.ComposeCommandLine(append([]string{program}, args...)))
	if err != nil {
		return nil, err
	}
	var cwd *uint16
	if dir != "" {
		cwd, err = windows.UTF16PtrFromString(dir)
		if err != nil {
			return nil, err
		}
	}
	environment, err := environmentBlock(env)
	if err != nil {
		return nil, err
	}
	var envPtr *uint16
	if environment != nil {
		envPtr = &environment[0]
	}

	p := &Process{done: make(chan struct{}), readDone: make(chan struct{})}
	p.readCond = sync.NewCond(&p.readMu)
	var inputRead, inputWrite, outputRead, outputWrite windows.Handle
	if err = windows.CreatePipe(&inputRead, &inputWrite, nil, 0); err != nil {
		return nil, err
	}
	defer windows.CloseHandle(inputRead)
	p.input = os.NewFile(uintptr(inputWrite), "localpty-input")
	defer func() {
		if err != nil {
			p.input.Close()
			if p.output != nil {
				p.output.Close()
			}
			if p.job != 0 {
				windows.CloseHandle(p.job)
			}
			if p.console != 0 {
				windows.ClosePseudoConsole(p.console)
			}
		}
	}()
	if err = windows.CreatePipe(&outputRead, &outputWrite, nil, 0); err != nil {
		return nil, err
	}
	defer windows.CloseHandle(outputWrite)
	p.output = os.NewFile(uintptr(outputRead), "localpty-output")
	if err = windows.CreatePseudoConsole(windows.Coord{X: int16(cols), Y: int16(rows)}, inputRead, outputWrite, 0, &p.console); err != nil {
		return nil, fmt.Errorf("create pseudoconsole: %w", err)
	}
	p.job, err = windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, err
	}
	limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	limits.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	if _, err = windows.SetInformationJobObject(p.job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&limits)), uint32(unsafe.Sizeof(limits))); err != nil {
		return nil, err
	}
	attrs, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
		return nil, err
	}
	defer attrs.Delete()
	// HPCON is itself the opaque pointer expected by this attribute, not &HPCON.
	consolePointer := *(*unsafe.Pointer)(unsafe.Pointer(&p.console))
	if err = attrs.Update(windows.PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, consolePointer, unsafe.Sizeof(p.console)); err != nil {
		return nil, err
	}
	si := windows.StartupInfoEx{ProcThreadAttributeList: attrs.List()}
	si.Cb = uint32(unsafe.Sizeof(si))
	// Explicit null standard handles select ConPTY. Without this flag Windows
	// can duplicate a redirected parent's streams even with inheritHandles=false.
	si.Flags = windows.STARTF_USESTDHANDLES
	var pi windows.ProcessInformation
	flags := uint32(windows.EXTENDED_STARTUPINFO_PRESENT | windows.CREATE_UNICODE_ENVIRONMENT | windows.CREATE_SUSPENDED)
	if err = windows.CreateProcess(app, command, nil, nil, false, flags, envPtr, cwd, &si.StartupInfo, &pi); err != nil {
		return nil, fmt.Errorf("start terminal process: %w", err)
	}
	defer windows.CloseHandle(pi.Thread)
	// The process cannot create children until it belongs to our kill-on-close job.
	if err = windows.AssignProcessToJobObject(p.job, pi.Process); err != nil {
		windows.TerminateProcess(pi.Process, 1)
		windows.CloseHandle(pi.Process)
		return nil, fmt.Errorf("own terminal process: %w", err)
	}
	if _, err = windows.ResumeThread(pi.Thread); err != nil {
		windows.TerminateProcess(pi.Process, 1)
		windows.CloseHandle(pi.Process)
		return nil, err
	}
	p.pid = int(pi.ProcessId)
	go p.drain()
	go p.reap(pi.Process)
	return p, nil
}

func (p *Process) PID() int                    { return p.pid }
func (p *Process) Write(b []byte) (int, error) { return p.input.Write(b) }
func (p *Process) Read(b []byte) (int, error) {
	if len(b) == 0 {
		return 0, nil
	}
	p.readMu.Lock()
	defer p.readMu.Unlock()
	for p.buffer.Len() == 0 && p.readErr == nil {
		p.readCond.Wait()
	}
	if p.buffer.Len() != 0 {
		return p.buffer.Read(b)
	}
	return 0, p.readErr
}

func (p *Process) Resize(cols, rows int) error {
	if err := validSize(cols, rows); err != nil {
		return err
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.console == 0 {
		return os.ErrClosed
	}
	return windows.ResizePseudoConsole(p.console, windows.Coord{X: int16(cols), Y: int16(rows)})
}

func (p *Process) Wait() error { <-p.done; return p.waitErr }

// Close is concurrent-safe and idempotent, and terminates only this owned tree.
func (p *Process) Close() error {
	p.finish()
	<-p.done
	return p.closeErr
}

func (p *Process) finish() {
	p.closeOnce.Do(func() {
		p.mu.Lock()
		console, job := p.console, p.job
		p.console, p.job = 0, 0
		p.mu.Unlock()
		p.closeErr = windows.CloseHandle(job)
		p.input.Close()
		// The drain goroutine never waits for a consumer, including during close.
		// Older Windows versions block here until final console output is drained.
		windows.ClosePseudoConsole(console)
		<-p.readDone
		p.output.Close()
	})
}

func (p *Process) reap(handle windows.Handle) {
	_, err := windows.WaitForSingleObject(handle, windows.INFINITE)
	if err == nil {
		var code uint32
		err = windows.GetExitCodeProcess(handle, &code)
		if err == nil && code != 0 {
			err = &ExitError{Code: code}
		}
	}
	windows.CloseHandle(handle)
	p.finish()
	p.readMu.Lock()
	if errors.Is(p.readErr, ErrOutputOverflow) {
		err = ErrOutputOverflow
	}
	p.readMu.Unlock()
	p.waitErr = err
	close(p.done)
}

func (p *Process) drain() {
	defer close(p.readDone)
	buf := make([]byte, 32*1024)
	for {
		n, err := p.output.Read(buf)
		p.readMu.Lock()
		overflow := false
		if n > 0 && p.readErr == nil {
			if p.buffer.Len()+n > maxUnreadOutput {
				p.readErr = ErrOutputOverflow
				overflow = true
			} else {
				p.buffer.Write(buf[:n])
			}
		}
		if err != nil && p.readErr == nil {
			p.readErr = err
		}
		p.readCond.Broadcast()
		p.readMu.Unlock()
		if overflow {
			go p.Close()
		}
		if err != nil {
			return
		}
	}
}

func environmentBlock(env []string) ([]uint16, error) {
	if env == nil {
		return nil, nil
	}
	values := make(map[string]string, len(env))
	for _, entry := range env {
		if strings.ContainsRune(entry, 0) {
			return nil, errors.New("environment contains NUL")
		}
		i := strings.IndexByte(entry, '=')
		if i == 0 {
			i = strings.IndexByte(entry[1:], '=') + 1
		}
		if i < 1 {
			return nil, errors.New("invalid environment entry")
		}
		values[strings.ToUpper(entry[:i])] = entry
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var block []uint16
	for _, key := range keys {
		block = append(block, utf16.Encode([]rune(values[key]))...)
		block = append(block, 0)
	}
	if len(block) == 0 {
		block = append(block, 0)
	}
	return append(block, 0), nil
}

var _ io.ReadWriteCloser = (*Process)(nil)
