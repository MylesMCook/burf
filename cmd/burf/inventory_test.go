package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestInventoryCLIRequests(t *testing.T) {
	cases := []struct {
		kind         string
		args         []string
		method, path string
	}{
		{"machines", []string{"list", "--json"}, "GET", "/v1/machines"},
		{"machines", []string{"add", "--ssh", "my-host", "--name", "Lab"}, "POST", "/v1/machines"},
		{"machines", []string{"routes", "machine-one", "--ssh", "my-host", "--paired", "box-one"}, "PUT", "/v1/machines/machine-one/routes"},
		{"machines", []string{"refresh", "machine-one"}, "POST", "/v1/machines/machine-one/refresh"},
		{"services", []string{"list", "--machine", "machine-one"}, "GET", "/v1/machines/machine-one/inventory"},
		{"services", []string{"history", "service-one", "--machine", "machine-one", "--after", "4"}, "GET", "/v1/machines/machine-one/history?after=4&limit=100&service=service-one"},
	}
	for _, tc := range cases {
		r, err := parseInventoryRequest(tc.kind, tc.args)
		if err != nil {
			t.Fatal(tc.args, err)
		}
		if r.method != tc.method || r.path != tc.path {
			t.Fatalf("%v: %+v", tc.args, r)
		}
		if r.output == "machine" && tc.args[0] == "add" {
			b, _ := json.Marshal(r.body)
			if strings.Contains(string(b), "updated_at") || strings.Contains(string(b), `"id"`) {
				t.Fatal("registration sends stored fields")
			}
		}
	}
}

func TestInventoryCLIRejectsUnsafeTargetsAndCursors(t *testing.T) {
	for _, args := range [][]string{{"add", "--name", "Lab", "--ssh", "-oProxyCommand=evil"}, {"add", "--name", "Lab", "--ssh", "lab;evil"}, {"add", "--name", "Lab", "--ssh", "lab", "--os", "unknown"}} {
		if _, err := parseInventoryRequest("machines", args); err == nil {
			t.Fatal("accepted", args)
		}
	}
	for _, args := range [][]string{{"list"}, {"history", "svc", "--machine", "m", "--after", "-1"}, {"history", "svc", "--machine", "m", "--limit", "501"}} {
		if _, err := parseInventoryRequest("services", args); err == nil {
			t.Fatal("accepted", args)
		}
	}
}

func TestInventoryCLIRejectsFlagsFromAnotherCommand(t *testing.T) {
	for _, tc := range []struct {
		kind string
		args []string
	}{
		{"machines", []string{"list", "--machine", "m"}},
		{"services", []string{"list", "--machine", "m", "--ssh", "host"}},
	} {
		if _, err := parseInventoryRequest(tc.kind, tc.args); err == nil {
			t.Fatalf("accepted unrelated command flags: %s %v", tc.kind, tc.args)
		}
	}
}
