package box

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/hooks"
	"github.com/sean-brydon/berthd/internal/statefile"
)

// Flows are automations built from steps rather than shell scripts: when an
// event happens, run a check, prompt an agent, wait for it, start another,
// notify someone, or call a webhook, each step on the previous one's success
// or failure. They run on the box, so they keep going while the laptop
// sleeps. A box has its own flows, and a repository's config can carry flows
// for its own worktrees, layered like the rest of its config: committed in
// the repository, then its kit's, then this box's own, the most local flow
// with an id replacing the others.

type Flow struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Enabled bool    `json:"enabled"`
	Trigger Trigger `json:"trigger"`
	Steps   []Step  `json:"steps"`
	// MaxRunsPerHour stops a flow that keeps triggering itself, such as one
	// prompting the agent whose finishing started it. Zero means
	// DefaultMaxRunsPerHour.
	MaxRunsPerHour int `json:"max_runs_per_hour,omitempty"`
}

// DefaultMaxRunsPerHour is how many times a flow may start in an hour when
// it doesn't say. The app's DEFAULT_MAX_RUNS_PER_HOUR (app/src/lib/flows.ts)
// shows the same number.
const DefaultMaxRunsPerHour = 20

// Trigger is what starts a flow, narrowed by Where: an event, a schedule,
// or something happening on GitHub. Exactly one of the three is set.
type Trigger struct {
	Event string `json:"event,omitempty"`
	// Schedule is a cron expression (minute hour day month weekday) or a
	// shortcut like @daily, in the box's local time.
	Schedule string `json:"schedule,omitempty"`
	// EachWorktree runs a scheduled flow once per worktree matching Where,
	// rather than once at the repository's main checkout.
	EachWorktree bool           `json:"each_worktree,omitempty"`
	GitHub       *GitHubTrigger `json:"github,omitempty"`
	Where        Where          `json:"where,omitempty"`
}

// GitHubTrigger watches the pull requests of a project's worktrees.
type GitHubTrigger struct {
	// On is review_comment, pr_review, check_failed or pr_merged.
	On string `json:"on"`
	// Poll is how often to look, at least 1m; default 2m.
	Poll string `json:"poll,omitempty"`
}

var githubOns = map[string]bool{"review_comment": true, "pr_review": true, "check_failed": true, "pr_merged": true}

// Where narrows a trigger; empty fields match anything. Branch takes a
// trailing * for a prefix.
type Where struct {
	Location string `json:"location,omitempty"`
	Agent    string `json:"agent,omitempty"`
	Branch   string `json:"branch,omitempty"`
}

// Step is one action. Kind picks which fields matter:
//   - run: Command (in the event's worktree), Timeout
//   - prompt: Text, sent to the event's session or Session
//   - wait: For (states, default finished,waiting), Timeout, Session
//   - start_agent: Agent, Text (its prompt), NewWorktree + Name
//   - notify: Title, Text
//   - webhook: URL, Text (the JSON body; default the run's context)
//
// When runs it on the previous step's "success" (default), "failure", or
// "always". Text fields take {{event.FIELD}}, {{worktree.path}},
// {{prev.output}}, {{prev.exit_code}} and {{steps.ID.output}}, filled in
// for each kind of field as flowtemplate.go describes: never as code.
type Step struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	When        string   `json:"when,omitempty"`
	Command     string   `json:"command,omitempty"`
	Text        string   `json:"text,omitempty"`
	Title       string   `json:"title,omitempty"`
	Session     string   `json:"session,omitempty"`
	For         []string `json:"for,omitempty"`
	Agent       string   `json:"agent,omitempty"`
	NewWorktree bool     `json:"new_worktree,omitempty"`
	Name        string   `json:"name,omitempty"`
	URL         string   `json:"url,omitempty"`
	Timeout     string   `json:"timeout,omitempty"`
}

var (
	flowID    = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,47}$`)
	stepKinds = map[string]bool{"run": true, "prompt": true, "wait": true, "start_agent": true, "notify": true, "webhook": true}
)

func validateTrigger(t Trigger) error {
	set := 0
	for _, on := range []bool{t.Event != "", t.Schedule != "", t.GitHub != nil} {
		if on {
			set++
		}
	}
	if set != 1 {
		return errors.New("a flow starts from exactly one of an event, a schedule, or GitHub")
	}
	switch {
	case t.Event != "":
		if err := hooks.Validate([]hooks.Hook{{On: t.Event, Run: "x"}}); err != nil || strings.HasPrefix(t.Event, hooks.BeforePrefix) {
			return fmt.Errorf("%q is not an event to start from", t.Event)
		}
	case t.Schedule != "":
		if _, err := ParseCron(t.Schedule); err != nil {
			return err
		}
	default:
		if !githubOns[t.GitHub.On] {
			return fmt.Errorf("GitHub trigger %q must be review_comment, pr_review, check_failed or pr_merged", t.GitHub.On)
		}
		if t.GitHub.Poll != "" {
			if d, err := time.ParseDuration(t.GitHub.Poll); err != nil || d < time.Minute {
				return fmt.Errorf("GitHub poll %q must be a duration of at least 1m", t.GitHub.Poll)
			}
		}
	}
	if t.EachWorktree && t.Schedule == "" {
		return errors.New("each_worktree only applies to scheduled flows")
	}
	return nil
}

// ValidateFlows reports the first thing wrong with flows someone wrote.
func ValidateFlows(flows []Flow) error {
	seen := map[string]bool{}
	for _, f := range flows {
		if !flowID.MatchString(f.ID) {
			return fmt.Errorf("flow id %q must be lowercase letters, digits and dashes", f.ID)
		}
		if seen[f.ID] {
			return fmt.Errorf("two flows are called %s", f.ID)
		}
		seen[f.ID] = true
		if strings.TrimSpace(f.Name) == "" {
			return fmt.Errorf("flow %s needs a name", f.ID)
		}
		if err := validateTrigger(f.Trigger); err != nil {
			return fmt.Errorf("flow %s: %v", f.ID, err)
		}
		if len(f.Steps) == 0 {
			return fmt.Errorf("flow %s has no steps", f.ID)
		}
		steps := map[string]bool{}
		for i, s := range f.Steps {
			where := fmt.Sprintf("flow %s, step %d", f.ID, i+1)
			if !stepKinds[s.Kind] {
				return fmt.Errorf("%s: unknown kind %q", where, s.Kind)
			}
			if s.ID != "" {
				if steps[s.ID] {
					return fmt.Errorf("%s: two steps are called %s", where, s.ID)
				}
				steps[s.ID] = true
			}
			switch s.When {
			case "", "success", "failure", "always":
			default:
				return fmt.Errorf("%s: when must be success, failure or always", where)
			}
			need := map[string]string{"run": s.Command, "prompt": s.Text, "start_agent": s.Agent, "notify": s.Title, "webhook": s.URL}[s.Kind]
			if s.Kind != "wait" && strings.TrimSpace(need) == "" {
				return fmt.Errorf("%s (%s) is missing what to do", where, s.Kind)
			}
			if s.Kind == "webhook" && !strings.HasPrefix(s.URL, "https://") && !strings.HasPrefix(s.URL, "http://") {
				return fmt.Errorf("%s: webhook URL must be http or https", where)
			}
			if s.Timeout != "" {
				if d, err := time.ParseDuration(s.Timeout); err != nil || d <= 0 {
					return fmt.Errorf("%s: timeout %q is not a duration", where, s.Timeout)
				}
			}
		}
	}
	return nil
}

// FlowRun is one run of a flow, kept for its history.
type FlowRun struct {
	ID       string       `json:"id"`
	Flow     string       `json:"flow"`
	Scope    string       `json:"scope"`
	Started  time.Time    `json:"started"`
	Finished time.Time    `json:"finished,omitzero"`
	Status   string       `json:"status"` // running, succeeded, failed
	Event    events.Event `json:"event"`
	Steps    []StepRun    `json:"steps"`
	Error    string       `json:"error,omitempty"`
	// Test is set for a run started from the app's Test run, not by its
	// trigger, so Runs can say so.
	Test bool `json:"test,omitempty"`
}

// testRun marks the context of a run started by Test run.
type testRun struct{}

type StepRun struct {
	ID       string    `json:"id"`
	Kind     string    `json:"kind"`
	Status   string    `json:"status"` // succeeded, failed, skipped
	Started  time.Time `json:"started,omitzero"`
	Duration string    `json:"duration,omitempty"`
	Output   string    `json:"output,omitempty"`
	ExitCode int       `json:"exit_code"`
	Error    string    `json:"error,omitempty"`
}

// Flows runs a box's flows and its repositories'.
type Flows struct {
	// Path is the box's own flows file, ~/.berth/flows.json.
	Path string
	// RunsPath keeps recent runs across restarts.
	RunsPath string

	// GitHubPath keeps what GitHub flows have already seen.
	GitHubPath string
	// Now reads the clock; tests replace it.
	Now func() time.Time
	// AllowOutbound adds to the outbound allowlist in network.json beside
	// Path (see netguard.go); tests use it for their local servers.
	AllowOutbound []string

	mu        sync.Mutex
	runs      []FlowRun
	recent    map[string][]time.Time // flow scope/id → start times this hour
	running   map[string]bool        // flow scope/id + worktree
	loaded    bool
	lastFired map[string]time.Time // scheduled flow → minute it last fired
	lastPoll  map[string]time.Time // GitHub flow → when it last looked
	gh        map[string]*ghState  // GitHub flow + PR → what it has seen
}

const maxFlowRuns = 200

// ScopedFlow is a flow with where it comes from.
type ScopedFlow struct {
	Scope string `json:"scope"` // "box" or "repo:<location>"
	// Source is "box", or for a repository's flow its layer: "repo"
	// (committed), "kit" (the location's kit) or "local" (this box's).
	Source   string `json:"source"`
	Editable bool   `json:"editable"`
	// Overridden is set on a flow a more local layer replaces with a flow of
	// the same id. It is listed so the app can show it, but never runs.
	Overridden bool `json:"overridden,omitempty"`
	Flow       Flow `json:"flow"`
}

func (f *Flows) loadBox() ([]Flow, error) {
	var doc struct {
		Flows []Flow `json:"flows"`
	}
	b, err := os.ReadFile(f.Path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(b, &doc); err != nil {
		return nil, fmt.Errorf("%s: %w", f.Path, err)
	}
	return doc.Flows, nil
}

// SaveBox replaces the box's own flows.
func (f *Flows) SaveBox(flows []Flow) error {
	if err := ValidateFlows(flows); err != nil {
		return err
	}
	if flows == nil {
		flows = []Flow{}
	}
	b, err := json.MarshalIndent(map[string]any{"flows": flows}, "", "  ")
	if err != nil {
		return err
	}
	return statefile.Write(f.Path, append(b, '\n'))
}

// AllFlows lists every flow on the box: its own, then each repository's
// layers in the order its config merges them (committed, its kit's, this
// box's). A flow replaced by id in a more local layer is marked Overridden;
// ActiveFlows leaves those out.
func (b *Box) AllFlows(ctx context.Context) ([]ScopedFlow, error) {
	out := []ScopedFlow{}
	own, err := b.Flows.loadBox()
	if err != nil {
		return nil, err
	}
	for _, f := range own {
		out = append(out, ScopedFlow{Scope: "box", Source: "box", Editable: true, Flow: f})
	}
	locs, _ := b.Locations.List(ctx)
	for _, l := range locs {
		cfg, err := b.Locations.Config(ctx, l.Name)
		if err != nil {
			continue
		}
		scope, start := "repo:"+l.Name, len(out)
		add := func(source string, editable bool, flows []Flow) {
			for _, f := range flows {
				out = append(out, ScopedFlow{Scope: scope, Source: source, Editable: editable, Flow: f})
			}
		}
		if cfg.Repo != nil {
			add("repo", false, cfg.Repo.Flows)
		}
		if cfg.Kit != nil {
			add("kit", false, cfg.Kit.Config.Flows)
		}
		add("local", true, cfg.Local.Flows)
		// Like merge: a later layer's flow replaces an earlier one's by id.
		for i := start; i < len(out); i++ {
			for j := i + 1; j < len(out); j++ {
				if out[j].Flow.ID == out[i].Flow.ID {
					out[i].Overridden = true
				}
			}
		}
	}
	return out, nil
}

// ActiveFlows is the flows that run: AllFlows without the overridden ones,
// so each scope has at most one flow per id, and its run limit and schedule
// are its own.
func (b *Box) ActiveFlows(ctx context.Context) ([]ScopedFlow, error) {
	all, err := b.AllFlows(ctx)
	if err != nil {
		return nil, err
	}
	out := all[:0]
	for _, sf := range all {
		if !sf.Overridden {
			out = append(out, sf)
		}
	}
	return out, nil
}

// Run follows the box's events and starts the flows they trigger.
func (f *Flows) Run(ctx context.Context, b *Box) {
	go f.schedule(ctx, b)
	go f.watchGitHub(ctx, b)
	ch, stop := b.Events.Subscribe()
	defer stop()
	for {
		select {
		case <-ctx.Done():
			return
		case e := <-ch:
			// A flow's own bookkeeping never starts flows.
			if strings.HasPrefix(e.Type, "flow.") {
				continue
			}
			all, err := b.ActiveFlows(ctx)
			if err != nil {
				continue
			}
			for _, sf := range all {
				if sf.Flow.Enabled && b.flowMatches(ctx, sf, e) {
					go b.runFlow(context.WithoutCancel(ctx), sf, e)
				}
			}
		}
	}
}

func (b *Box) flowMatches(ctx context.Context, sf ScopedFlow, e events.Event) bool {
	t := sf.Flow.Trigger
	if t.Event == "" || !hooks.Matches(hooks.Hook{On: t.Event, Run: "x"}, e) {
		return false
	}
	loc, wt, ok := b.eventScope(ctx, e.Data)
	if name, isRepo := strings.CutPrefix(sf.Scope, "repo:"); isRepo && (!ok || loc.Name != name) {
		return false
	}
	if t.Where.Location != "" && (!ok || loc.Name != t.Where.Location) {
		return false
	}
	if t.Where.Agent != "" {
		if a, _ := e.Data["agent"].(string); a != t.Where.Agent {
			return false
		}
	}
	if t.Where.Branch != "" {
		if !ok {
			return false
		}
		if p, prefix := strings.CutSuffix(t.Where.Branch, "*"); prefix {
			if !strings.HasPrefix(wt.Branch, p) {
				return false
			}
		} else if wt.Branch != t.Where.Branch {
			return false
		}
	}
	return true
}

// admit decides whether a run may start: not while the same flow already
// runs for the same worktree, and not past its hourly limit.
func (f *Flows) admit(key, slot string, limit int) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.recent == nil {
		f.recent, f.running = map[string][]time.Time{}, map[string]bool{}
	}
	if f.running[key+"@"+slot] {
		return false
	}
	if limit <= 0 {
		limit = DefaultMaxRunsPerHour
	}
	cut := time.Now().Add(-time.Hour)
	kept := f.recent[key][:0]
	for _, t := range f.recent[key] {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= limit {
		f.recent[key] = kept
		return false
	}
	f.recent[key] = append(kept, time.Now())
	f.running[key+"@"+slot] = true
	return true
}

func (f *Flows) done(key, slot string) {
	f.mu.Lock()
	delete(f.running, key+"@"+slot)
	f.mu.Unlock()
}

func (f *Flows) record(run FlowRun) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.loadRuns()
	for i := range f.runs {
		if f.runs[i].ID == run.ID {
			f.runs[i] = run
			f.saveRuns()
			return
		}
	}
	f.runs = append(f.runs, run)
	if len(f.runs) > maxFlowRuns {
		f.runs = f.runs[len(f.runs)-maxFlowRuns:]
	}
	f.saveRuns()
}

// loadRuns and saveRuns are called with f.mu held.
func (f *Flows) loadRuns() {
	if f.loaded || f.RunsPath == "" {
		f.loaded = true
		return
	}
	f.loaded = true
	if b, err := os.ReadFile(f.RunsPath); err == nil {
		json.Unmarshal(b, &f.runs)
	}
}

func (f *Flows) saveRuns() {
	if f.RunsPath == "" {
		return
	}
	if b, err := json.Marshal(f.runs); err == nil {
		statefile.Write(f.RunsPath, b)
	}
}

// Runs returns recent runs, newest first, optionally of one flow.
func (f *Flows) Runs(flow string, limit int) []FlowRun {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.loadRuns()
	out := []FlowRun{}
	for i := len(f.runs) - 1; i >= 0 && len(out) < limit; i-- {
		if flow == "" || f.runs[i].Flow == flow {
			out = append(out, f.runs[i])
		}
	}
	return out
}

var runSeq struct {
	sync.Mutex
	n int
}

func newRunID() string {
	runSeq.Lock()
	defer runSeq.Unlock()
	runSeq.n++
	return strconv.FormatInt(time.Now().UnixMilli(), 36) + "-" + strconv.Itoa(runSeq.n)
}

// runFlow runs a flow's steps in order for one event.
func (b *Box) runFlow(ctx context.Context, sf ScopedFlow, e events.Event) FlowRun {
	// One key per effective flow: a scope has one active flow per id.
	key := sf.Scope + "/" + sf.Flow.ID
	loc, wt, scoped := b.eventScope(ctx, e.Data)
	slot := wt.Path
	if !b.Flows.admit(key, slot, sf.Flow.MaxRunsPerHour) {
		return FlowRun{Status: "skipped"}
	}
	defer b.Flows.done(key, slot)

	run := FlowRun{ID: newRunID(), Flow: sf.Flow.ID, Scope: sf.Scope, Started: time.Now().UTC(), Status: "running", Event: e, Test: ctx.Value(testRun{}) == true}
	vars := map[string]string{"event.type": e.Type, "event.box": e.Box, "event.origin": e.Origin, "now": time.Now().Format(time.RFC3339)}
	for k, v := range e.Data {
		vars["event."+k] = fmt.Sprint(v)
	}
	var env, secrets []string
	if scoped {
		vars["location"], vars["worktree.name"], vars["worktree.path"], vars["worktree.branch"] = loc.Name, wt.Name, wt.Path, wt.Branch
		env, secrets = b.flowEnv(ctx, loc.Name, wt)
	}
	session, _ := e.Data["session"].(string)
	if session == "" && scoped {
		session = b.sessionIn(ctx, wt.Path)
	}
	b.Flows.record(run)
	b.Events.Publish(events.Event{Type: "flow.started", Box: b.Name, Origin: "flow:" + sf.Flow.ID, Data: map[string]any{"flow": sf.Flow.ID, "scope": sf.Scope, "run": run.ID, "path": wt.Path}})

	prevOK := true
	failed := false
	for i, s := range sf.Flow.Steps {
		id := s.ID
		if id == "" {
			id = strconv.Itoa(i + 1)
		}
		sr := StepRun{ID: id, Kind: s.Kind}
		when := s.When
		if when == "" {
			when = "success"
		}
		if (when == "success" && !prevOK) || (when == "failure" && prevOK) {
			sr.Status = "skipped"
			run.Steps = append(run.Steps, sr)
			b.Flows.record(run)
			continue
		}
		sr.Started = time.Now().UTC()
		out, code, err := b.runStep(ctx, sf.Flow.ID, s, vars, env, secrets, loc, wt, scoped, &session)
		sr.Duration = time.Since(sr.Started).Round(time.Millisecond).String()
		// Runs are kept on disk and shown in the app: a secret a command
		// printed is not kept with them.
		sr.Output, sr.ExitCode = tail(redact(out, secrets), 4000), code
		if err != nil {
			sr.Status, sr.Error = "failed", redact(err.Error(), secrets)
		} else {
			sr.Status = "succeeded"
		}
		prevOK = err == nil
		// A failure that a later step handles is not the flow failing.
		failed = !prevOK && !handled(sf.Flow.Steps[i+1:])
		vars["prev.output"], vars["prev.exit_code"] = sr.Output, strconv.Itoa(code)
		vars["steps."+id+".output"], vars["steps."+id+".exit_code"] = sr.Output, strconv.Itoa(code)
		run.Steps = append(run.Steps, sr)
		b.Flows.record(run)
	}
	run.Finished = time.Now().UTC()
	run.Status = "succeeded"
	if failed {
		run.Status = "failed"
	}
	b.Flows.record(run)
	b.Events.Publish(events.Event{Type: "flow.finished", Box: b.Name, Origin: "flow:" + sf.Flow.ID, Data: map[string]any{"flow": sf.Flow.ID, "scope": sf.Scope, "run": run.ID, "status": run.Status, "path": wt.Path}})
	return run
}

func handled(rest []Step) bool {
	for _, s := range rest {
		if s.When == "failure" || s.When == "always" {
			return true
		}
	}
	return false
}

func tail(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return "…" + s[len(s)-n:]
}

// sessionIn finds the agent session working in dir, if there is one.
func (b *Box) sessionIn(ctx context.Context, dir string) string {
	all, err := b.Sessions.List(ctx)
	if err != nil {
		return ""
	}
	for _, s := range b.enrich(ctx, all) {
		if samePath(s.Dir, dir) && s.Agent != "" && !s.Exited {
			return s.Name
		}
	}
	return ""
}

func stepTimeout(s Step, def time.Duration) time.Duration {
	if d, err := time.ParseDuration(s.Timeout); err == nil && d > 0 {
		return min(d, 2*time.Hour)
	}
	return def
}

// flowEnv is a worktree's environment for a flow's commands, and the
// secret values in it, which nothing the flow sends or keeps may carry.
func (b *Box) flowEnv(ctx context.Context, location string, wt Worktree) (env, secrets []string) {
	p, err := b.worktreeEnv(ctx, location, wt)
	if err != nil {
		return nil, nil
	}
	values := b.resolveWorktreeSecrets(ctx, p.location, wt, p.refs, p.opEnv)
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	env = p.env
	for _, k := range keys {
		env = append(env, k+"="+values[k])
		secrets = append(secrets, values[k])
	}
	// Longest first, so one secret containing another is hidden whole.
	sort.Slice(secrets, func(i, j int) bool { return len(secrets[i]) > len(secrets[j]) })
	return env, secrets
}

func (b *Box) runStep(ctx context.Context, flow string, s Step, vars map[string]string, env, secrets []string, loc Location, wt Worktree, scoped bool, session *string) (string, int, error) {
	origin := "flow:" + flow
	switch s.Kind {
	case "run":
		dir := wt.Path
		if !scoped {
			dir, _ = os.UserHomeDir()
		}
		ctx, cancel := context.WithTimeout(ctx, stepTimeout(s, 10*time.Minute))
		defer cancel()
		// Values reach the command only through its environment.
		script, flowVars := shellTemplate(s.Command, vars)
		cmd := exec.CommandContext(ctx, loginShell(), "-lc", script)
		cmd.Dir = dir
		cmd.Env = append(append(os.Environ(), env...), flowVars...)
		var out tailBuffer
		cmd.Stdout, cmd.Stderr = &out, &out
		err := cmd.Run()
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return out.String(), ee.ExitCode(), fmt.Errorf("exited with %d", ee.ExitCode())
		}
		return out.String(), 0, err
	case "prompt":
		target := s.Session
		if target == "" {
			target = *session
		}
		if target == "" {
			return "", 0, errors.New("no agent session to prompt in this worktree")
		}
		if err := b.Sessions.Send(ctx, target, expand(s.Text, vars), true); err != nil {
			return "", 0, err
		}
		b.Events.Publish(events.Event{Type: "session.sent", Box: b.Name, Origin: origin, Data: map[string]any{"name": target}})
		*session = target
		return "sent to " + target, 0, nil
	case "wait":
		target := s.Session
		if target == "" {
			target = *session
		}
		if target == "" {
			return "", 0, errors.New("no agent session to wait for in this worktree")
		}
		states := s.For
		if len(states) == 0 {
			states = []string{"finished", "waiting"}
		}
		state, err := b.awaitState(ctx, target, states, stepTimeout(s, 30*time.Minute))
		if err != nil {
			return state, 0, err
		}
		vars["agent.state"] = state
		return state, 0, nil
	case "start_agent":
		if !scoped {
			return "", 0, errors.New("starting an agent needs an event in a worktree")
		}
		p, ok := presetFor(&loc, s.Agent)
		if !ok {
			return "", 0, fmt.Errorf("unknown agent %q", s.Agent)
		}
		command := AgentCommand(p, expand(s.Text, vars))
		dir, where := wt.Path, loc.Name+"/"+wt.Name
		if s.NewWorktree {
			name := slug(expand(s.Name, vars), 40)
			if name == "" {
				name = slug(wt.Name+"-"+s.Agent, 40)
			}
			nw, err := b.Locations.CreateWorktree(ctx, loc.Name, name, "", wt.Branch)
			if err != nil {
				return "", 0, err
			}
			b.Events.Publish(events.Event{Type: "worktree.created", Box: b.Name, Origin: origin, Data: map[string]any{"location": loc.Name, "name": nw.Name, "path": nw.Path, "branch": nw.Branch}})
			dir, where = nw.Path, loc.Name+"/"+nw.Name
		}
		sess, err := b.createSession(ctx, defaultSessionName(where, command), where, dir, command)
		if err != nil {
			return "", 0, err
		}
		b.Events.Publish(events.Event{Type: "session.started", Box: b.Name, Origin: origin, Data: map[string]any{"name": sess.Name, "location": where, "path": dir, "command": command}})
		*session = sess.Name
		return "started " + sess.Name, 0, nil
	case "notify":
		data := map[string]any{"title": redact(expand(s.Title, vars), secrets), "body": redact(expand(s.Text, vars), secrets), "flow": flow}
		if scoped {
			data["path"], data["location"] = wt.Path, loc.Name
		}
		b.Events.Publish(events.Event{Type: "notify", Box: b.Name, Origin: origin, Data: data})
		return "notified", 0, nil
	case "webhook":
		// Neither the body nor the URL carries a secret's value, whatever a
		// step printed.
		safe := make(map[string]string, len(vars))
		for k, v := range vars {
			safe[k] = redact(v, secrets)
		}
		body := expandJSON(s.Text, safe)
		if strings.TrimSpace(body) == "" {
			j, _ := json.Marshal(safe)
			body = string(j)
		}
		body = redact(body, secrets)
		target := redact(expandURL(s.URL, safe), secrets)
		if u, err := url.Parse(target); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return "", 0, errors.New("webhook URL is not an http or https URL")
		}
		timeout := stepTimeout(s, 15*time.Second)
		ctx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewBufferString(body))
		if err != nil {
			return "", 0, err
		}
		req.Header.Set("Content-Type", "application/json")
		// Only to public addresses, unless the box's owner allows more.
		resp, err := b.outboundPolicy().client(timeout).Do(req)
		if err != nil {
			return "", 0, err
		}
		defer resp.Body.Close()
		var rb bytes.Buffer
		rb.ReadFrom(io.LimitReader(resp.Body, 16<<10))
		if resp.StatusCode >= 300 {
			return rb.String(), resp.StatusCode, fmt.Errorf("webhook answered %s", resp.Status)
		}
		return rb.String(), resp.StatusCode, nil
	}
	return "", 0, fmt.Errorf("unknown step %q", s.Kind)
}

// awaitState waits for a session's agent to report one of states from now.
func (b *Box) awaitState(ctx context.Context, session string, states []string, timeout time.Duration) (string, error) {
	want := map[string]bool{}
	for _, s := range states {
		want[s] = true
	}
	after := time.Now()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	ch, stop := b.Events.Subscribe()
	defer stop()
	tick := time.NewTicker(2 * time.Second)
	defer tick.Stop()
	for {
		all, err := b.Sessions.List(ctx)
		if err == nil {
			for _, s := range b.enrich(ctx, all) {
				if s.Name != session {
					continue
				}
				if s.Exited {
					return "exited", errors.New(session + " has exited")
				}
				if want[s.AgentState] && s.StateSince.After(after) {
					return s.AgentState, nil
				}
			}
		}
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("%s did not finish within %v", session, timeout)
		case <-ch:
		case <-tick.C:
		}
	}
}

func (b *Box) listFlows(w http.ResponseWriter, r *http.Request) error {
	all, err := b.AllFlows(r.Context())
	if err != nil {
		return err
	}
	writeJSON(w, all)
	return nil
}

func (b *Box) putFlows(w http.ResponseWriter, r *http.Request) error {
	var req struct {
		Flows []Flow `json:"flows"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	if err := b.before(r, "config.change", map[string]any{"flows": len(req.Flows)}); err != nil {
		return err
	}
	if err := b.Flows.SaveBox(req.Flows); err != nil {
		return badRequest("%v", err)
	}
	b.publish(r, "config.changed", map[string]any{"flows": len(req.Flows)})
	return b.listFlows(w, r)
}

// testFlow runs a flow now, as if its trigger had happened with the given
// event data (a worktree path, a session).
func (b *Box) testFlow(w http.ResponseWriter, r *http.Request) error {
	var req struct {
		Scope string         `json:"scope"`
		Data  map[string]any `json:"data"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	all, err := b.ActiveFlows(r.Context())
	if err != nil {
		return err
	}
	for _, sf := range all {
		if sf.Flow.ID == r.PathValue("id") && (req.Scope == "" || sf.Scope == req.Scope) {
			// A test run runs the flow's steps for real.
			if err := b.before(r, "flow.test", map[string]any{"flow": sf.Flow.ID, "scope": sf.Scope}); err != nil {
				return err
			}
			e := events.Event{Type: triggerType(sf.Flow.Trigger), Box: b.Name, Origin: origin(r), Time: time.Now(), Data: req.Data}
			run := b.runFlow(context.WithValue(context.WithoutCancel(r.Context()), testRun{}, true), sf, e)
			writeJSON(w, run)
			return nil
		}
	}
	return httpError{http.StatusNotFound, "no flow with that id"}
}

func (b *Box) listFlowRuns(w http.ResponseWriter, r *http.Request) error {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > maxFlowRuns {
		limit = 50
	}
	writeJSON(w, b.Flows.Runs(r.URL.Query().Get("flow"), limit))
	return nil
}

// FlowsAt keeps a box's flows in userDir and their runs in stateDir.
func FlowsAt(userDir, stateDir string) *Flows {
	return &Flows{Path: filepath.Join(userDir, "flows.json"), RunsPath: filepath.Join(stateDir, "flow-runs.json"), GitHubPath: filepath.Join(stateDir, "flow-github.json")}
}
