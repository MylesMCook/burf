package box

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/MylesMCook/burf/internal/localchat"
	"github.com/MylesMCook/burf/internal/wire"
)

// Burf's own tools in a structured chat (the "chat.tools" capability).
//
// The provider's sandbox cannot reach this box's socket, so nothing a chat's
// agent runs as a command can add an artifact, start a task or hear back from
// one. A chat therefore gets Burf's tools as a server of its own:
//
//	provider -> burfd mcp --chat ID (stdio, started by the provider for this
//	chat only, outside its sandbox) -> this box's own socket
//
// It is the box's ordinary tool server (internal/mcpserver) working for the
// chat: work it starts names the chat as its caller, so the report comes
// back into the chat as Burf's own message when the chat is next idle. The
// box adds no listener and edits no provider configuration.
//
// A tool that acts outside the sandbox (a command, a task, a prompt to
// another agent) first asks the chat's person, in the chat, with what it
// would do. Only this box's own socket may ask. A chat in full access was
// told to act without asking.

// chatCaller marks a chat among the callers work reports back to.
const chatCaller = "chat:"

const maxToolApprovalBody = 16 << 10

// maxChatReport is under what a chat takes as one message (localchat, 64 KiB).
const maxChatReport = 60 << 10

// chatTools binds a chat's tools to this daemon's executable and socket.
func (b *Box) chatTools() *localchat.Tools {
	exe, err := os.Executable()
	if b.Socket == "" || err != nil {
		return nil
	}
	socket := b.Socket
	return &localchat.Tools{Server: func(chat string) (string, []string) {
		return exe, []string{"mcp", "--socket", socket, "--chat", chat}
	}}
}

// chatOf is the live chat a caller names, if it names one.
func (b *Box) chatOf(caller string) (localchat.Session, bool) {
	id, ok := strings.CutPrefix(caller, chatCaller)
	if !ok || id == "" || b.Chats == nil {
		return localchat.Session{}, false
	}
	s, err := b.Chats.Get(id)
	return s, err == nil
}

func (b *Box) mountChatTools(add func(string, func(http.ResponseWriter, *http.Request) error)) {
	// Held open until the person answers, the turn ends or the wait runs out.
	add("POST /v1/chats/{id}/tools/approve", func(w http.ResponseWriter, r *http.Request) error {
		if !wire.IsLocal(r.Context()) {
			return httpError{http.StatusForbidden, "only this box's own tools may ask a chat's person"}
		}
		var req struct {
			Tool   string `json:"tool"`
			Detail string `json:"detail"`
		}
		if err := decodeChatLimit(r, &req, maxToolApprovalBody); err != nil {
			return err
		}
		if err := b.Chats.ToolApproval(r.Context(), r.PathValue("id"), req.Tool, req.Detail); err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]bool{"ok": true})
		return nil
	})
}

// reportToChat hands a chat what became of work it started.
func (b *Box) reportToChat(ctx context.Context, id, text string) error {
	s, err := b.Chats.Get(id)
	switch {
	case err != nil:
		return ErrUnknownSession
	case s.State == "exited":
		return ErrSessionExited
	}
	return b.Chats.Report(ctx, id, text)
}
