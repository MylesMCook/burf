package main

import (
	"strings"
	"testing"

	"github.com/cosscom/shipyard/internal/doctor"
)

// The app records which renderer its terminals got; doctor says when
// ghostty-web failed, and why, so a fallback is never silent.
func TestDoctorReportsATerminalFallback(t *testing.T) {
	if _, ok := (terminalRenderer{}).check("app"); ok {
		t.Fatal("no record should be no line")
	}
	c, _ := terminalRenderer{Renderer: "xterm", Chosen: "ghostty", Reason: "WebAssembly.compile: refused"}.check("app")
	if c.Status != doctor.Warn || !strings.Contains(c.Detail, "WebAssembly.compile: refused") {
		t.Fatalf("fallback = %+v", c)
	}
	if c, _ := (terminalRenderer{Renderer: "ghostty", Chosen: "ghostty"}).check("app"); c.Status != doctor.OK {
		t.Fatalf("ghostty = %+v", c)
	}
	if c, _ := (terminalRenderer{Renderer: "xterm", Chosen: "xterm"}).check("app"); c.Status != doctor.Info {
		t.Fatalf("chosen xterm = %+v", c)
	}
}
