package box

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestLegacyKitStateIsPreservedAndIgnored(t *testing.T) {
	dir := t.TempDir()
	l := NewLocations(filepath.Join(dir, "locations.json"))
	kit := json.RawMessage(`{"id":"old","future":{"key":"kept"},"config":{"setup":"false","env":{"OLD":"1"},"agents":[{"id":"old","command":"false"}],"flows":[{"id":"old","enabled":true}]}}`)
	state, err := json.Marshal([]map[string]any{{"name": "project", "path": dir, "kit": kit, "future": true}})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(l.path, state, 0600); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	cfg, err := l.Config(ctx, "project")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Effective.Setup != "" || len(cfg.Effective.Env) != 0 || len(cfg.Effective.Agents) != 0 || len(cfg.Effective.Flows) != 0 {
		t.Fatalf("legacy kit applied: %+v", cfg.Effective)
	}
	if !bytes.Equal(cfg.Kit, kit) {
		t.Fatalf("legacy wire field = %s", cfg.Kit)
	}
	loc, err := l.Get(ctx, "project")
	if err != nil || loc.Scripts.Setup != "" || loc.Scripts.From != "" || len(loc.Agents) != 0 {
		t.Fatalf("location = %+v, err = %v", loc, err)
	}
	b := &Box{Locations: l, Flows: &Flows{Path: filepath.Join(dir, "flows.json")}}
	flows, err := b.AllFlows(ctx)
	if err != nil || len(flows) != 0 {
		t.Fatalf("legacy flows = %+v, err = %v", flows, err)
	}
	after, err := os.ReadFile(l.path)
	if err != nil || !bytes.Equal(state, after) {
		t.Fatalf("reading changed state: %v", err)
	}
	if err := l.SetScripts("project", "echo local", ""); err != nil {
		t.Fatal(err)
	}
	saved, err := l.saved("project")
	if err != nil {
		t.Fatal(err)
	}
	var beforeKit, afterKit any
	if err := json.Unmarshal(kit, &beforeKit); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(saved.Kit, &afterKit); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(beforeKit, afterKit) {
		t.Fatalf("saving dropped legacy kit data: %s", saved.Kit)
	}
}

func TestRemovedBoxSetupRoutesReturnNotFound(t *testing.T) {
	c, _ := servedBox(t)
	for _, route := range []string{
		"GET /v1/team", "POST /v1/team", "GET /v1/team/acme",
		"POST /v1/team/acme/retry", "POST /v1/team/acme/onepassword",
		"GET /v1/kits", "PUT /v1/locations/project/kit", "DELETE /v1/locations/project/kit",
	} {
		t.Run(route, func(t *testing.T) {
			method, path, _ := strings.Cut(route, " ")
			if status := call(t, c, method, path, "", nil, nil); status != http.StatusNotFound {
				t.Fatalf("status = %d, want 404", status)
			}
		})
	}
}
