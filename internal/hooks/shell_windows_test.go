package hooks

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
)

func TestNativeWindowsHookReceivesTheEventAndEnvironment(t *testing.T) {
	h := Hook{Run: "[Console]::Write([Console]::In.ReadToEnd()); [Console]::WriteLine(); [Console]::Write($env:BERTH_ORIGIN)", Tool: "windows-test"}
	e := events.Event{Type: "unit.test"}
	out, err := Exec(context.Background(), h, e, 15*time.Second, nil)
	if err != nil {
		t.Fatalf("hook failed: %v (%s)", err, out)
	}
	want, _ := json.Marshal(e)
	if string(out) != string(want)+"\r\nwindows-test" {
		t.Fatalf("event/environment output = %q", out)
	}
}
