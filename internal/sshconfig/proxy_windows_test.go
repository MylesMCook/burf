package sshconfig

import (
	"reflect"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

func TestWindowsProxyCommandPreservesArguments(t *testing.T) {
	const exe = `C:\Program Files\Berth's & ^ (%h)\berth.exe`
	for _, network := range []string{"", "personal", "work net", `x&echo injected`, `x|echo injected`, `x\" y\`, "$(touch marker)", "`touch marker`", "%h%p", "x\ny"} {
		command := ProxyCommand(exe, network)
		expanded := strings.NewReplacer("%%", "%", "%h", "host", "%p", "22").Replace(command)
		args, err := windows.DecomposeCommandLine(expanded)
		want := []string{exe, "network", "proxy", network, "host", "22"}
		if err != nil || !reflect.DeepEqual(args, want) {
			t.Errorf("Windows parsed %q as %#v, %v; want %#v", command, args, err, want)
		}
	}
}
