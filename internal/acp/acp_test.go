package acp

import (
	"encoding/json"
	"testing"
)

func TestRequestShape(t *testing.T) {
	raw, err := json.Marshal(Request("1", "initialize", map[string]any{"protocolVersion": ProtocolVersion}))
	if err != nil {
		t.Fatal(err)
	}
	var msg map[string]any
	if json.Unmarshal(raw, &msg) != nil {
		t.Fatal(msg)
	}
	if msg["jsonrpc"] != JSONRPC || msg["method"] != "initialize" || msg["id"] != "1" {
		t.Fatalf("%s", raw)
	}
}

func TestPermissionOutcome(t *testing.T) {
	raw, _ := json.Marshal(PermissionSelected("allow-once"))
	if string(raw) != `{"outcome":{"optionId":"allow-once","outcome":"selected"}}` && string(raw) != `{"outcome":{"outcome":"selected","optionId":"allow-once"}}` {
		t.Fatalf("%s", raw)
	}
}
