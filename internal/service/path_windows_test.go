package service

import (
	"errors"
	"testing"
	"time"
)

func TestWindowsServicePATHUsesInheritedEnvironmentWithoutAShell(t *testing.T) {
	path := `C:\Tools\bin;C:\Windows\System32`
	t.Setenv("PATH", path)
	t.Setenv("SHELL", `C:\not-a-login-shell\sh.exe`)
	if got := ServicePATH(); got != path {
		t.Fatalf("ServicePATH = %q", got)
	}
	if got, err := LoginShellPATH(time.Second); err != nil || got != path {
		t.Fatalf("LoginShellPATH = %q, %v", got, err)
	}
	if got := AugmentPATH(); got != path {
		t.Fatalf("AugmentPATH = %q", got)
	}
	t.Setenv("PATH", "")
	if _, err := LoginShellPATH(time.Second); !errors.Is(err, errNoPATH) {
		t.Fatalf("empty inherited PATH = %v", err)
	}
}
