package box

import (
	"net/http"
	"strconv"
	"sync"

	"github.com/sean-brydon/berthd/internal/transcript"
)

// The Conversation view's data: GET /v1/sessions/{name}/transcript?since=N
// reads the session's agent's own transcript (internal/transcript). Like
// the screen, it is the session's content, so only paired peers reach it;
// tool output and thinking are never included, and nothing is stored.

var (
	transcriptsOnce sync.Once
	transcripts     *transcript.Reader
)

func (b *Box) transcript(w http.ResponseWriter, r *http.Request) error {
	transcriptsOnce.Do(func() { transcripts = transcript.NewReader() })
	sess, err := b.Sessions.Get(r.Context(), r.PathValue("name"))
	if err != nil {
		return err
	}
	since, _ := strconv.Atoi(r.URL.Query().Get("since"))
	agent := sess.Preset
	if agent == "" {
		agent = sess.Agent
	}
	var id string
	if b.Turns != nil {
		if st, ok := b.Turns.State(sess.Name); ok {
			id = st.AgentSessionID
		}
	}
	var path string
	switch agent {
	case "claude":
		path = transcript.ClaudePath(sess.Dir, id, sess.Created)
	case "codex":
		path = transcript.CodexPath(sess.Dir, id, sess.Created)
	}
	if path == "" {
		writeJSON(w, transcript.Result{Source: "none", Items: []transcript.Item{}, Crew: []transcript.CrewMember{}})
		return nil
	}
	res, err := transcripts.Read(agent, path, sess.Dir, max(since, 0))
	if err != nil {
		writeJSON(w, transcript.Result{Source: "none", Items: []transcript.Item{}, Crew: []transcript.CrewMember{}})
		return nil
	}
	writeJSON(w, res)
	return nil
}
