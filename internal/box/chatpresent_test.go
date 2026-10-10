package box

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/hooks"
	"github.com/MylesMCook/burf/internal/localchat"
)

const presentForm = `{"type":"form","message":"Pick the next action","fields":[{"name":"action","label":"Action","kind":"choice","options":["Inspect","Continue"],"required":true,"value":""}]}`

func askPresentation(t *testing.T, f *browserFixture, id string) (localchat.Presentation, <-chan localchat.Presentation) {
	t.Helper()
	done := make(chan localchat.Presentation, 1)
	go func() {
		var p localchat.Presentation
		err := f.local.Call(context.Background(), "POST", "/v1/chats/"+id+"/tools/present", json.RawMessage(presentForm), &p)
		if err != nil {
			t.Error(err)
		}
		done <- p
	}()
	var p localchat.Presentation
	waitUntil(t, "pending presentation", time.Second, func() bool {
		s, _ := f.box.Chats.Get(id)
		for _, it := range s.Items {
			if it.Presentation != nil && it.Presentation.State == "request" {
				p = *it.Presentation
				return true
			}
		}
		return false
	})
	return p, done
}

func TestPresentationSocketOwnershipStrictInputAndOneUseReply(t *testing.T) {
	f := newBrowserFixture(t)
	s := f.startBrowserChat(t)
	path := "/v1/chats/" + s.ID + "/tools/present"
	if w := chatRequest(f.h, http.MethodPost, path, presentForm); w.Code != 403 {
		t.Fatal("paired client published data", w.Code, w.Body)
	}
	for _, body := range []string{`{"type":"chart","label":"x","value":"1","points":[1],"html":"bad"}`, `{"type":"form","message":"x","fields":[],"state":"accepted"}`} {
		if err := f.local.Call(context.Background(), http.MethodPost, path, json.RawMessage(body), nil); err == nil {
			t.Fatal("invalid presentation was published", body)
		}
	}
	p, done := askPresentation(t, f, s.ID)
	var shown Chat
	_ = json.Unmarshal(chatRequest(f.h, http.MethodGet, "/v1/chats/"+s.ID, "").Body.Bytes(), &shown)
	if shown.State != "waiting" || len(shown.Approvals) != 0 {
		t.Fatal(shown)
	}
	answerPath := "/v1/chats/" + s.ID + "/presentations/" + p.ID + "/answer"
	if w := chatRequest(f.h, http.MethodPost, answerPath, `{"action":"accept","values":{"action":"Continue"},"extra":true}`); w.Code != 400 {
		t.Fatal("unknown fields accepted", w.Code, w.Body)
	}
	if w := chatRequest(f.h, http.MethodPost, answerPath, `{"action":"accept","values":{"action":"unsupported"}}`); w.Code != 409 {
		t.Fatal("invalid choice accepted", w.Code, w.Body)
	}
	if w := chatRequest(f.h, http.MethodPost, answerPath, `{"action":"accept","values":{"action":"Inspect"}}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	select {
	case result := <-done:
		if result.State != "accepted" || result.Fields[0].Value != "Inspect" {
			t.Fatal(result)
		}
	case <-time.After(time.Second):
		t.Fatal("tool did not receive answer")
	}
	if w := chatRequest(f.h, http.MethodPost, answerPath, `{"action":"accept","values":{"action":"Inspect"}}`); w.Code != 409 {
		t.Fatal("replayed form answer", w.Code, w.Body)
	}
}

func TestPresentationAnswerPassesTheSendHookWithoutConsumingOnDenial(t *testing.T) {
	f := newBrowserFixture(t)
	s := f.startBrowserChat(t)
	p, done := askPresentation(t, f, s.ID)
	cfg := filepath.Join(t.TempDir(), "hooks.json")
	data, _ := json.Marshal(hooks.Config{Hooks: []hooks.Hook{{On: "before:session.send", Run: "echo answer denied; exit 1"}}})
	if err := os.WriteFile(cfg, data, 0600); err != nil {
		t.Fatal(err)
	}
	f.box.Hooks = &hooks.Runner{Path: cfg}
	path := fmt.Sprintf("/v1/chats/%s/presentations/%s/answer", s.ID, p.ID)
	w := chatRequest(f.h, http.MethodPost, path, `{"action":"accept","values":{"action":"Continue"}}`)
	if w.Code != 403 || !strings.Contains(w.Body.String(), "answer denied") {
		t.Fatal(w.Code, w.Body)
	}
	select {
	case <-done:
		t.Fatal("denied response reached provider")
	default:
	}
	f.box.Hooks = nil
	if w := chatRequest(f.h, http.MethodPost, path, `{"action":"decline"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	select {
	case result := <-done:
		if result.State != "declined" {
			t.Fatal(result)
		}
	case <-time.After(time.Second):
		t.Fatal("tool remained pending")
	}
}
