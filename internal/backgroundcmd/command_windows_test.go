package backgroundcmd

import (
	"testing"

	"golang.org/x/sys/windows"
)

func assertNoConsole(t *testing.T) {
	t.Helper()
	window, _, _ := windows.NewLazySystemDLL("kernel32.dll").NewProc("GetConsoleWindow").Call()
	if window != 0 {
		t.Fatal("background child received a console window")
	}
}
