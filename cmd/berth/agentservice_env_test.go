package main

import (
	"reflect"
	"testing"
)

func TestWindowsAgentServiceKeepsExplicitIsolatedEnvironment(t *testing.T) {
	t.Setenv("BERTH_HOME", "must not replace the resolved home")
	t.Setenv("BERTH_USER_DIR", `C:\Berth's isolated & user`)
	t.Setenv("BERTH_UI_ADDR", "127.0.0.1:41234")
	t.Setenv("BERTH_PROXY_ADDR", "127.0.0.1:42345")
	home := `C:\Berth's isolated state`
	want := map[string]string{
		"BERTH_HOME":       home,
		"BERTH_USER_DIR":   `C:\Berth's isolated & user`,
		"BERTH_UI_ADDR":    "127.0.0.1:41234",
		"BERTH_PROXY_ADDR": "127.0.0.1:42345",
	}
	if got := agentServiceEnv(home, "windows"); !reflect.DeepEqual(got, want) {
		t.Fatalf("Windows login environment = %v, want literal isolated overrides %v", got, want)
	}
	for _, platform := range []string{"darwin", "linux"} {
		if got := agentServiceEnv(home, platform); !reflect.DeepEqual(got, map[string]string{"BERTH_HOME": home}) {
			t.Fatalf("%s login environment changed: %v", platform, got)
		}
	}
}

func TestWindowsAgentServiceOmitsEmptyOverrides(t *testing.T) {
	for _, name := range []string{"BERTH_USER_DIR", "BERTH_UI_ADDR", "BERTH_PROXY_ADDR"} {
		t.Setenv(name, "")
	}
	want := map[string]string{"BERTH_HOME": `C:\isolated`}
	if got := agentServiceEnv(want["BERTH_HOME"], "windows"); !reflect.DeepEqual(got, want) {
		t.Fatalf("empty overrides were persisted: %v", got)
	}
}
