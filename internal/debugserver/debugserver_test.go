package debugserver

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestReadCountsThisProcess(t *testing.T) {
	s := Read()
	if s.Goroutines < 1 || s.OpenFiles < 1 || s.HeapAlloc == 0 {
		t.Fatalf("implausible: %+v", s)
	}
}

func TestStartServesOnLoopbackOnly(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	ln.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	t.Setenv(Env, "0.0.0.0:0")
	var said string
	Start(ctx, func(f string, a ...any) { said = f })
	if said == "" {
		t.Fatal("a non-loopback address was not refused")
	}

	t.Setenv(Env, addr)
	Start(ctx, func(string, ...any) {})
	var s Stats
	for i := 0; ; i++ {
		res, err := http.Get("http://" + addr + "/debug/berth")
		if err == nil {
			err = json.NewDecoder(res.Body).Decode(&s)
			res.Body.Close()
			break
		}
		if i > 50 {
			t.Fatal(err)
		}
		time.Sleep(20 * time.Millisecond)
	}
	if s.Goroutines < 1 {
		t.Fatalf("stats: %+v", s)
	}
}
