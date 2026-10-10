package box

import (
	"encoding/json"
	"net/http"

	"github.com/MylesMCook/burf/internal/localchat"
	"github.com/MylesMCook/burf/internal/wire"
)

func (b *Box) mountChatPresent(add func(string, func(http.ResponseWriter, *http.Request) error)) {
	add("POST /v1/chats/{id}/tools/present", func(w http.ResponseWriter, r *http.Request) error {
		if !wire.IsLocal(r.Context()) {
			return httpError{http.StatusForbidden, "only this box's own tools may present data"}
		}
		var raw json.RawMessage
		if err := decodeChatLimit(r, &raw, localchat.MaxPresentationBytes); err != nil {
			return err
		}
		p, err := localchat.ParsePresentation(raw)
		if err != nil {
			return httpError{http.StatusBadRequest, err.Error()}
		}
		result, err := b.Chats.Present(r.Context(), r.PathValue("id"), p)
		if err != nil {
			return chatError(err)
		}
		writeJSON(w, result)
		return nil
	})
	add("POST /v1/chats/{id}/presentations/{presentation}/answer", func(w http.ResponseWriter, r *http.Request) error {
		var answer localchat.PresentationAnswer
		if err := decodeChatLimit(r, &answer, localchat.MaxPresentationBytes); err != nil {
			return err
		}
		if err := b.beforeChat(r, "session.send"); err != nil {
			return err
		}
		if err := b.Chats.AnswerPresentation(r.PathValue("id"), r.PathValue("presentation"), answer); err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]bool{"ok": true})
		return nil
	})
}
