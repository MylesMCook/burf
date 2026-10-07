// Package debugserver serves a process's own numbers for measuring it over
// time (app/perf/soak-go.mjs): goroutines, open files and memory as JSON
// at /debug/berth, and Go's profiles under /debug/pprof/. It runs only when
// BERTH_DEBUG_ADDR names a loopback address, on a listener of its own,
// never on the agent's or the box's API.
package debugserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/pprof"
	"os"
	"runtime"
	"time"
)

// Env is the variable that turns it on, as host:port on loopback.
const Env = "BERTH_DEBUG_ADDR"

// Stats is what /debug/berth answers.
type Stats struct {
	Goroutines int    `json:"goroutines"`
	OpenFiles  int    `json:"open_files"`
	HeapAlloc  uint64 `json:"heap_alloc"`
	HeapInuse  uint64 `json:"heap_inuse"`
	Sys        uint64 `json:"sys"`
	NumGC      uint32 `json:"num_gc"`
	// CPU time used by the process so far, in seconds (user and system).
	CPUSeconds float64 `json:"cpu_seconds"`
	// CPU time of the programs it ran (tmux, git), once they ended.
	ChildCPUSeconds float64 `json:"children_cpu_seconds"`
	Uptime          float64 `json:"uptime_seconds"`
}

var started = time.Now()

// Read gathers Stats now.
func Read() Stats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	s := Stats{Goroutines: runtime.NumGoroutine(), HeapAlloc: m.HeapAlloc, HeapInuse: m.HeapInuse, Sys: m.Sys, NumGC: m.NumGC, Uptime: time.Since(started).Seconds()}
	if fds, err := os.ReadDir("/dev/fd"); err == nil {
		// One of them is the directory being read.
		s.OpenFiles = len(fds) - 1
	}
	s.CPUSeconds = cpuSeconds(self)
	s.ChildCPUSeconds = cpuSeconds(children)
	return s
}

// Start serves the numbers on BERTH_DEBUG_ADDR until ctx ends, if it is set
// to a loopback address. logf says where, or why not.
func Start(ctx context.Context, logf func(string, ...any)) {
	addr := os.Getenv(Env)
	if addr == "" {
		return
	}
	host, _, err := net.SplitHostPort(addr)
	if ip := net.ParseIP(host); err != nil || (host != "localhost" && (ip == nil || !ip.IsLoopback())) {
		logf("debug server: %s=%q is not a loopback address; not serving", Env, addr)
		return
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		logf("debug server: %v", err)
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/debug/berth", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Read())
	})
	mux.HandleFunc("/debug/pprof/", pprof.Index)
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		_ = srv.Close()
	}()
	go func() { _ = srv.Serve(ln) }()
	logf("debug server on http://%s/debug/berth", ln.Addr())
}

// String is Stats as one line, for logs.
func (s Stats) String() string {
	return fmt.Sprintf("goroutines %d, open files %d, heap %d KB, cpu %.2fs", s.Goroutines, s.OpenFiles, s.HeapAlloc/1024, s.CPUSeconds)
}
