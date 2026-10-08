package localchat

import (
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

type stdioProcess struct {
	input, output, stderr *os.File
	job                   windows.Handle
	once                  sync.Once
	done                  chan struct{}
}

// StartProcess creates a hidden app-server with private pipes, already owned by
// a kill-on-close job before it can create descendants. No shared daemon proxy.
func StartProcess(options LaunchOptions) (_ Process, err error) {
	program, cwd := options.Program, options.CWD
	if !filepath.IsAbs(program) || !strings.EqualFold(filepath.Ext(program), ".exe") {
		return nil, errors.New("Codex must be an absolute native executable path")
	}
	app, err := windows.UTF16PtrFromString(program)
	if err != nil {
		return nil, err
	}
	command, err := windows.UTF16PtrFromString(windows.ComposeCommandLine([]string{program, "app-server", "--listen", "stdio://"}))
	if err != nil {
		return nil, err
	}
	dir, err := windows.UTF16PtrFromString(cwd)
	if err != nil {
		return nil, err
	}
	environment, err := environmentBlock(options.Env)
	if err != nil {
		return nil, err
	}
	var envPtr *uint16
	if environment != nil {
		envPtr = &environment[0]
	}
	p := &stdioProcess{done: make(chan struct{})}
	defer func() {
		if err != nil {
			for _, f := range []*os.File{p.input, p.output, p.stderr} {
				if f != nil {
					f.Close()
				}
			}
			if p.job != 0 {
				windows.CloseHandle(p.job)
			}
		}
	}()
	sa := windows.SecurityAttributes{Length: uint32(unsafe.Sizeof(windows.SecurityAttributes{})), InheritHandle: 1}
	var inR, inW, outR, outW, errR, errW windows.Handle
	if err = windows.CreatePipe(&inR, &inW, &sa, 0); err != nil {
		return nil, err
	}
	defer windows.CloseHandle(inR)
	p.input = os.NewFile(uintptr(inW), "codex-input")
	if err = windows.SetHandleInformation(inW, windows.HANDLE_FLAG_INHERIT, 0); err != nil {
		return nil, err
	}
	if err = windows.CreatePipe(&outR, &outW, &sa, 0); err != nil {
		return nil, err
	}
	defer windows.CloseHandle(outW)
	p.output = os.NewFile(uintptr(outR), "codex-output")
	if err = windows.SetHandleInformation(outR, windows.HANDLE_FLAG_INHERIT, 0); err != nil {
		return nil, err
	}
	if err = windows.CreatePipe(&errR, &errW, &sa, 0); err != nil {
		return nil, err
	}
	defer windows.CloseHandle(errW)
	p.stderr = os.NewFile(uintptr(errR), "codex-errors")
	if err = windows.SetHandleInformation(errR, windows.HANDLE_FLAG_INHERIT, 0); err != nil {
		return nil, err
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
	handles := []windows.Handle{inR, outW, errW}
	if err = attrs.Update(windows.PROC_THREAD_ATTRIBUTE_HANDLE_LIST, unsafe.Pointer(&handles[0]), uintptr(len(handles))*unsafe.Sizeof(handles[0])); err != nil {
		return nil, err
	}
	si := windows.StartupInfoEx{ProcThreadAttributeList: attrs.List()}
	si.Cb = uint32(unsafe.Sizeof(si))
	si.Flags = windows.STARTF_USESTDHANDLES
	si.StdInput = inR
	si.StdOutput = outW
	si.StdErr = errW
	var pi windows.ProcessInformation
	flags := uint32(windows.EXTENDED_STARTUPINFO_PRESENT | windows.CREATE_NO_WINDOW | windows.CREATE_SUSPENDED | windows.CREATE_UNICODE_ENVIRONMENT)
	if err = windows.CreateProcess(app, command, nil, nil, true, flags, envPtr, dir, &si.StartupInfo, &pi); err != nil {
		return nil, fmt.Errorf("start Codex app-server: %w", err)
	}
	defer windows.CloseHandle(pi.Thread)
	if err = windows.AssignProcessToJobObject(p.job, pi.Process); err != nil {
		windows.TerminateProcess(pi.Process, 1)
		windows.CloseHandle(pi.Process)
		return nil, fmt.Errorf("own Codex app-server: %w", err)
	}
	if _, err = windows.ResumeThread(pi.Thread); err != nil {
		windows.TerminateProcess(pi.Process, 1)
		windows.CloseHandle(pi.Process)
		return nil, err
	}
	// Stderr is never mixed into JSON or retained as an unbounded private log.
	go func() { _, _ = io.Copy(io.Discard, p.stderr) }()
	go func() {
		_, _ = windows.WaitForSingleObject(pi.Process, windows.INFINITE)
		windows.CloseHandle(pi.Process)
		p.finish()
		close(p.done)
	}()
	return p, nil
}
func (p *stdioProcess) Read(b []byte) (int, error)  { return p.output.Read(b) }
func (p *stdioProcess) Write(b []byte) (int, error) { return p.input.Write(b) }
func (p *stdioProcess) finish() {
	p.once.Do(func() { windows.CloseHandle(p.job); p.input.Close(); p.output.Close(); p.stderr.Close() })
}
func (p *stdioProcess) Close() error { p.finish(); <-p.done; return nil }

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
