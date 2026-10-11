package desktop

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/MylesMCook/burf/app/native/internal/nativefeedback"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// A Window handle without creating or running a native window. The production
// caller guard only reads ID; embedding preserves Wails' private interface methods.
type feedbackTestCaller struct {
	application.Window
	id uint
}

func (w feedbackTestCaller) ID() uint { return w.id }

func TestFeedbackCommandsRequireTrustedMainCaller(t *testing.T) {
	calls := 0
	service := New(Config{
		FeedbackStatus:  func() any { calls++; return nil },
		FeedbackEnable:  func() (any, error) { calls++; return nil, nil },
		FeedbackDisable: func() (any, error) { calls++; return nil, nil },
	})
	service.main = &application.WebviewWindow{}
	for _, command := range []string{"native_feedback_status", "native_feedback_enable", "native_feedback_disable"} {
		for _, ctx := range []context.Context{
			t.Context(),
			context.WithValue(t.Context(), application.WindowKey, feedbackTestCaller{id: 1}),
		} {
			if _, err := service.Invoke(ctx, command, json.RawMessage(`{}`)); err == nil {
				t.Fatalf("%s accepted an untrusted caller", command)
			}
		}
	}
	if calls != 0 {
		t.Fatal("untrusted caller reached feedback controller")
	}
	ctx := context.WithValue(t.Context(), application.WindowKey, feedbackTestCaller{id: service.main.ID()})
	for _, command := range []string{"native_feedback_status", "native_feedback_enable", "native_feedback_disable"} {
		// Arguments cannot select a path, origin, target or process; only main's
		// preconfigured zero-argument callback can be invoked.
		args := json.RawMessage(`{"directory":"/untrusted","origin":"https://example.invalid","companionURL":"http://127.0.0.1:1"}`)
		if _, err := service.Invoke(ctx, command, args); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := service.Invoke(ctx, "native_feedback_reconfigure", json.RawMessage(`{}`)); err == nil {
		t.Fatal("unknown feedback command accepted")
	}
	if calls != 3 {
		t.Fatal("finite trusted commands did not invoke exactly their callbacks")
	}
}

func TestFeedbackShutdownPermanentlyRevokesRuntime(t *testing.T) {
	base, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	directory := filepath.Join(base, "feedback")
	runtime, err := nativefeedback.NewRuntime(nativefeedback.RuntimeConfig{Directory: directory, Origin: "wails://localhost"})
	if err != nil {
		t.Fatal(err)
	}
	defer runtime.Close()
	service := New(Config{
		FeedbackStatus:  func() any { return runtime.Status() },
		FeedbackEnable:  func() (any, error) { return runtime.Enable() },
		FeedbackDisable: func() (any, error) { return runtime.Disable() },
		FeedbackClose:   runtime.Close,
	})
	service.main = &application.WebviewWindow{}
	ctx := context.WithValue(t.Context(), application.WindowKey, feedbackTestCaller{id: service.main.ID()})
	status, err := service.Invoke(ctx, "native_feedback_status", json.RawMessage(`{}`))
	if err != nil || status.(nativefeedback.RuntimeStatus).Enabled {
		t.Fatal("query enabled feedback")
	}
	if _, err := os.Lstat(directory); !os.IsNotExist(err) {
		t.Fatal("status query touched feedback state")
	}
	status, err = service.Invoke(ctx, "native_feedback_enable", json.RawMessage(`{}`))
	if err != nil || !status.(nativefeedback.RuntimeStatus).Enabled {
		t.Fatalf("enable: %v", err)
	}
	if err := service.ServiceShutdown(); err != nil {
		t.Fatal(err)
	}
	if runtime.Status().Enabled || runtime.Status().Endpoint != "" {
		t.Fatal("shutdown retained endpoint")
	}
	if _, err := service.Invoke(ctx, "native_feedback_enable", json.RawMessage(`{}`)); err == nil {
		t.Fatal("trusted callback recreated feedback during shutdown")
	}
	if err := service.ServiceShutdown(); err != nil {
		t.Fatal("repeated shutdown:", err)
	}
}

func TestFeedbackShutdownPreservesCloseFailure(t *testing.T) {
	want := errors.New("synthetic discovery withdrawal failure")
	service := New(Config{FeedbackClose: func() error { return want }})
	if err := service.ServiceShutdown(); !errors.Is(err, want) {
		t.Fatal("feedback close failure was hidden")
	}
}
