package box

import (
	"net/http"
	"strconv"
	"sync"
	"time"

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
	// Sessions.Get doesn't name the agent (the list does, in enrich): the
	// preset a session was started with, else its command's first word,
	// which is all a session from before presets has.
	agent := sess.Preset
	if agent == "" {
		agent = sess.Agent
	}
	if agent == "" {
		agent = agentOf(sess.Command)
	}
	var id string
	if b.Turns != nil {
		if st, ok := b.Turns.State(sess.Name); ok {
			id = st.AgentSessionID
		}
	}
	var path, where string
	switch agent {
	case "claude":
		path = transcript.ClaudePath(sess.Dir, id, sess.Created)
		where = transcript.ClaudeDir(sess.Dir)
	case "codex":
		path = transcript.CodexPath(sess.Dir, id, sess.Created)
		where = "~/.codex/sessions"
	}
	none := func(reason string) error {
		writeJSON(w, transcript.Result{Source: "none", Items: []transcript.Item{}, Crew: []transcript.CrewMember{}, Reason: reason})
		return nil
	}
	switch {
	case agent != "claude" && agent != "codex":
		return none("Berth reads Claude Code's and Codex's conversations; this session runs " + firstNonEmpty(agent, "no agent") + ".")
	case path == "":
		return none("No " + agent + " conversation for " + sess.Dir + " since " + sess.Created.Format(time.RFC3339) + " in " + where + ".")
	}
	res, err := transcripts.Read(agent, path, sess.Dir, max(since, 0))
	if err != nil {
		return none("Couldn't read " + path + ": " + err.Error())
	}
	writeJSON(w, res)
	return nil
}

