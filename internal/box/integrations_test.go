package box

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestIntegrationsReportAndInstallOneTool(t *testing.T) {
	home, path := t.TempDir(), t.TempDir()
	os.WriteFile(filepath.Join(path, "claude"), []byte("#!/bin/sh\n"), 0o755)
	t.Setenv("HOME", home)
	t.Setenv("PATH", path)
	c, _ := servedBox(t)

	tool := func(rep IntegrationsReport, id string) IntegrationTool {
		for _, x := range rep.Tools {
			if x.ID == id {
				return x
			}
		}
		t.Fatalf("no %s in %+v", id, rep)
		return IntegrationTool{}
	}
	var rep IntegrationsReport
	call(t, c, "GET", "/v1/integrations", "", nil, &rep)
	if claude := tool(rep, "claude"); !claude.Present || claude.Hooked || claude.Name != "Claude Code" {
		t.Fatalf("before: %+v", claude)
	}

	if status := call(t, c, "POST", "/v1/integrations/install", "", map[string]string{"tool": "claude"}, &rep); status != 200 {
		t.Fatalf("install: %d", status)
	}
	if !tool(rep, "claude").Hooked || !strings.Contains(rep.Output, "hooks added") {
		t.Fatalf("after: %+v", rep)
	}
	settings, _ := os.ReadFile(filepath.Join(home, ".claude", "settings.json"))
	if !strings.Contains(string(settings), " hook claude Stop") {
		t.Fatalf("settings.json = %s", settings)
	}
	if status := call(t, c, "POST", "/v1/integrations/install", "", map[string]string{"tool": "vim"}, nil); status != 400 {
		t.Fatalf("unknown tool: %d", status)
	}
}
