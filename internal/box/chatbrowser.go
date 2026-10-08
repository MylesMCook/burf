package box

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/MylesMCook/burf/internal/localchat"
	"github.com/MylesMCook/burf/internal/wire"
)

// The browser bridge (the "chat.browser" capability). A chat started with
// browser tools lets its provider act in the browser of the client that
// started it:
//
//	provider -> burfd browser-mcp (stdio, started by the provider for this
//	chat only) -> this box's own socket -> a call waiting on the chat ->
//	the client's browser performs it -> its result returns the same way.
//
// The box adds no listener and edits no provider configuration. Only the
// box's own socket may ask the browser to act; a paired client can only see
// the waiting calls and answer them. The browser is the reviewer: it asks the
// user per site before acting, so the box forwards calls without a second
// prompt.

const (
	maxChatStartBody     = 512 << 10
	maxBrowserCallBody   = 512 << 10
	maxBrowserResultBody = 3 << 20
	maxBrowserPoll       = 25
)

type chatBrowserRequest struct {
	Tools []localchat.BrowserTool `json:"tools"`
}

// chatBrowser binds a chat's bridge to this daemon's executable and socket.
func (b *Box) chatBrowser(req *chatBrowserRequest) (*localchat.Browser, error) {
	exe, err := os.Executable()
	if b.Socket == "" || err != nil {
		return nil, httpError{http.StatusNotImplemented, "browser tools are unavailable on this box"}
	}
	socket := b.Socket
	return &localchat.Browser{Tools: req.Tools, Server: func(chat string) (string, []string) {
		return exe, []string{"browser-mcp", "--socket", socket, "--chat", chat}
	}}, nil
}

func (b *Box) mountChatBrowser(add func(string, func(http.ResponseWriter, *http.Request) error)) {
	local := func(h func(http.ResponseWriter, *http.Request) error) func(http.ResponseWriter, *http.Request) error {
		return func(w http.ResponseWriter, r *http.Request) error {
			if !wire.IsLocal(r.Context()) {
				return httpError{http.StatusForbidden, "only this box's own bridge may ask the browser to act"}
			}
			return h(w, r)
		}
	}
	add("GET /v1/chats/{id}/browser/tools", local(func(w http.ResponseWriter, r *http.Request) error {
		tools, err := b.Chats.BrowserTools(r.PathValue("id"))
		if err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]any{"tools": tools})
		return nil
	}))
	// Held open until the browser answers, the turn ends or the wait runs out.
	add("POST /v1/chats/{id}/browser/calls", local(func(w http.ResponseWriter, r *http.Request) error {
		var req struct {
			Tool      string          `json:"tool"`
			Arguments json.RawMessage `json:"arguments"`
		}
		if err := decodeChatLimit(r, &req, maxBrowserCallBody); err != nil {
			return err
		}
		result, err := b.Chats.BrowserCall(r.Context(), r.PathValue("id"), req.Tool, req.Arguments)
		if err != nil {
			return chatError(err)
		}
		writeJSON(w, result)
		return nil
	}))
	// ?wait=N holds the request up to N seconds (at most 25) while no call waits.
	add("GET /v1/chats/{id}/browser/calls", func(w http.ResponseWriter, r *http.Request) error {
		wait, _ := strconv.Atoi(r.URL.Query().Get("wait"))
		wait = min(max(wait, 0), maxBrowserPoll)
		calls, err := b.Chats.BrowserCalls(r.Context(), r.PathValue("id"), time.Duration(wait)*time.Second)
		if err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]any{"calls": calls})
		return nil
	})
	add("POST /v1/chats/{id}/browser/results", func(w http.ResponseWriter, r *http.Request) error {
		var req struct {
			ID string `json:"id"`
			localchat.BrowserResult
		}
		if err := decodeChatLimit(r, &req, maxBrowserResultBody); err != nil {
			return err
		}
		// An answer reaches the model like a message, so it passes the same gate.
		if err := b.beforeChat(r, "session.send"); err != nil {
			return err
		}
		if err := b.Chats.BrowserResult(r.PathValue("id"), req.ID, req.BrowserResult); err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]bool{"ok": true})
		return nil
	})
}
