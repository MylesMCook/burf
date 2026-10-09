package agent

import (
	"context"
	"testing"

	"golang.org/x/sys/windows"
)

func TestManagementCLIHasNoConsole(t *testing.T) {
	a := &Agent{}
	cmd := a.cli(context.Background(), "discover", "--json")
	if cmd.SysProcAttr == nil || !cmd.SysProcAttr.HideWindow || cmd.SysProcAttr.CreationFlags&windows.CREATE_NO_WINDOW == 0 {
		t.Fatal("background management CLI can create a console and steal focus")
	}
}
