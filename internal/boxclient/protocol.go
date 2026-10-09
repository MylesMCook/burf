package boxclient

import (
	"encoding/json"
	"regexp"
	"time"

	"github.com/MylesMCook/burf/internal/box/runs"
	"github.com/MylesMCook/burf/internal/hooks"
	"github.com/MylesMCook/burf/internal/integrations"
	"github.com/MylesMCook/burf/internal/integrations/adapters"
	"github.com/MylesMCook/burf/internal/team"
	"github.com/MylesMCook/burf/internal/version"
)

// AgentBrowserSession is one agent-browser session a berth session started:
// its daemon and the browser processes under it.
type AgentBrowserSession struct {
	// BerthSession is the berth session that started it, and Live whether
	// that session's program still runs.
	BerthSession string `json:"berth_session"`
	Live         bool   `json:"live"`
	// Session is agent-browser's own session name (--session), Namespace
	// its --namespace, if any.
	Session   string `json:"session"`
	Namespace string `json:"namespace,omitempty"`
	// Daemon is the daemon's process, 0 when it is gone and only its
	// browser is left; PIDs are all of its processes, the daemon's first.
	Daemon int   `json:"daemon,omitempty"`
	PIDs   []int `json:"pids"`
	// Profiles are the browser's throwaway profile folders.
	Profiles []string `json:"profiles,omitempty"`
	// ClosedBy, once reaped, says what ended it: "agent-browser close",
	// "SIGTERM" or "SIGKILL".
	ClosedBy string `json:"closed_by,omitempty"`
}

// OriginHeader names the tool a request comes from, so the events it causes
// carry that origin and hooks driving the same tool skip them.
const OriginHeader = "X-Berth-Origin"

// SessionRequest starts a session: Command, or the Agent preset with its
// first Prompt. Open asks the app to show it ("split" or "tab").
type SessionRequest struct {
	Name     string `json:"name,omitempty"`
	Location string `json:"location"`
	Command  string `json:"command,omitempty"`
	Agent    string `json:"agent,omitempty"`
	Prompt   string `json:"prompt,omitempty"`
	// Model and Effort, with an agent: see TaskRequest.
	Model  string `json:"model,omitempty"`
	Effort string `json:"effort,omitempty"`
	Open   string `json:"open,omitempty"`
	// Title names the work; without one, the prompt's first line does.
	Title string `json:"title,omitempty"`
	// Home starts it in the box user's home folder rather than a
	// location: a terminal on the box, tied to no worktree. It takes a
	// command or a shell, never an agent preset, and no location.
	Home bool `json:"home,omitempty"`
}

// MaxAttachment is the largest file the box takes.
const MaxAttachment = 20 << 20

// BrowserStatus is a browser as status and lists show it.
type BrowserStatus struct {
	Location string    `json:"location"`
	Worktree string    `json:"worktree"`
	Path     string    `json:"path"`
	URL      string    `json:"url,omitempty"`
	PID      int       `json:"pid"`
	RSS      uint64    `json:"rss_bytes,omitempty"`
	Started  time.Time `json:"started"`
	LastUsed time.Time `json:"last_used"`
	Watchers int       `json:"watchers"`
	Refused  int       `json:"refused,omitempty"`
	// Viewport is the page's size, and Size it as text (1920×1080).
	Viewport Viewport `json:"viewport"`
	Size     string   `json:"size"`
}

// Every error the box answers with is {"error": "...", "code": "..."}. The
// message is for people and logs; the code is what clients branch on, so an
// app can say what happened in its own words and offer the one thing that
// helps (start the agent again, update the box) without reading the text.
//
// Codes:
//
//	not_found        no such session, worktree, location, share, …
//	session_exited   the session's program has ended; it takes no input
//	session_exists   a session with that name is already running
//	agent_waiting    the agent waits for an answer; sending would pick one
//	refused          a before: hook (or the box's own rules) said no
//	unsupported      this box doesn't have that feature
//	tmux_missing     tmux is not installed on the box
//	browser_blocked  the box's browser can't start its sandbox (browsersandbox.go)
//	git_failed       git refused; the message carries git's words
//	command_failed   a program the box ran failed
//	too_many         slow down and try again
//	file_changed     a write named a version of the file that is no longer
//	                 there (412); the answer carries the file as it is now
//	bad_request      the request itself was wrong
//	internal         anything else
const (
	CodeNotFound      = "not_found"
	CodeSessionExited = "session_exited"
	CodeSessionExists = "session_exists"
	CodeAgentWaiting  = "agent_waiting"
	CodeRefused       = "refused"
	CodeUnsupported   = "unsupported"
	CodeTmuxMissing   = "tmux_missing"
	CodeBrowserBlock  = "browser_blocked"
	CodeGitFailed     = "git_failed"
	CodeCommandFailed = "command_failed"
	CodeTooMany       = "too_many"
	CodeBadRequest    = "bad_request"
	CodeInternal      = "internal"
)

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
	// A trigger for a worktree where this flow's run is still going waits
	// for it: at most Queue of them (default 5). Coalesce merges new GitHub
	// items into the run already waiting instead, as {{event.items}}.
	Queue    int  `json:"queue,omitempty"`
	Coalesce bool `json:"coalesce,omitempty"`
}

// Trigger is what starts a flow, narrowed by Where: an event, a schedule,
// something happening on GitHub, or a signed POST to the box (Webhook).
// Exactly one is set.
type Trigger struct {
	Event string `json:"event,omitempty"`
	// Schedule is a cron expression (minute hour day month weekday) or a
	// shortcut like @daily, in the box's local time.
	Schedule string `json:"schedule,omitempty"`
	// EachWorktree runs a scheduled flow once per worktree matching Where,
	// rather than once at the repository's main checkout.
	EachWorktree bool           `json:"each_worktree,omitempty"`
	GitHub       *GitHubTrigger `json:"github,omitempty"`
	// Webhook starts the flow from POST /v1/triggers/<id>, signed with
	// the flow's secret (berth flows secret).
	Webhook *WebhookTrigger `json:"webhook,omitempty"`
	Where   Where           `json:"where,omitempty"`
}

// WebhookTrigger starts a flow from a signed POST: a CI job on the tailnet,
// or a Linear or Slack bridge you host.
type WebhookTrigger struct {
	// Worktree picks the worktree from a field of the posted JSON naming a
	// branch (default "branch"); without it the run is at the repository's
	// main checkout.
	BranchField string `json:"branch_field,omitempty"`
}

// GitHubTrigger watches the pull requests of a project's worktrees, or its
// issues.
type GitHubTrigger struct {
	// On is review_comment, pr_review, check_failed or pr_merged (a
	// worktree's pull request), or issue_labeled or issue_assigned (the
	// repository's open issues).
	On string `json:"on"`
	// Poll is how often to look, at least 1m; default 2m.
	Poll string `json:"poll,omitempty"`
	// Label is the label issue_labeled watches for.
	Label string `json:"label,omitempty"`
	// Assignee is who issue_assigned watches for; default @me, the account
	// gh is signed in as.
	Assignee string `json:"assignee,omitempty"`
}

// Where narrows a trigger; empty fields match anything. Branch takes a
// trailing * for a prefix.
type Where struct {
	Location string `json:"location,omitempty"`
	Agent    string `json:"agent,omitempty"`
	Branch   string `json:"branch,omitempty"`
	// Author limits GitHub triggers to comments and reviews by these
	// logins, or by the repository's "collaborators" (owners, members and
	// collaborators); "*" is anyone. review_comment and pr_review default
	// to collaborators: anyone can comment on a public repository, and the
	// comment reaches an agent's prompt.
	Author []string `json:"author,omitempty"`
}

// Step is one action of a flow: a run's step (see internal/box/runs).
// The kinds flows always had keep their meaning:
//   - run: Command (in the event's worktree), Timeout
//   - prompt: Text, sent to the event's session or Session
//   - wait: For (states, default finished,waiting), Timeout, Session
//   - start_agent: Agent, Text (its prompt), NewWorktree + Name
//   - notify: Title, Text
//   - webhook: URL, Text (the JSON body; default the run's context)
//
// and flows may use every run step kind too: loop, gate, map, join, judge,
// if, sleep, pr, check, headless.
//
// When runs it on the previous step's "success" (default), "failure", or
// "always". Text fields take {{event.FIELD}}, {{worktree.path}},
// {{prev.output}}, {{prev.exit_code}} and {{steps.ID.output}}, filled in
// for each kind of field as flowtemplate.go describes: never as code.
type Step = runs.Step

// Kit is a kit's manifest, kit.json.
type Kit struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version,omitempty"`
	// Match suggests the projects a kit is for.
	Match KitMatch `json:"match,omitempty"`
	// Requires lists tools the box needs; missing ones are reported, not
	// fatal, since a setup script may install them. They are looked for as
	// the box user's login shell finds them (logintools.go).
	Requires []KitRequirement `json:"requires,omitempty"`
	Config   RepoConfig       `json:"config"`
	// Files are small files carried in kit.json itself, path → content, so
	// a kit can be one file (a gist).
	Files map[string]string `json:"files,omitempty"`
}

type KitMatch struct {
	// Slug is the repository's "owner/repo".
	Slug string `json:"slug,omitempty"`
}

type KitRequirement struct {
	Tool string `json:"tool"`
	Hint string `json:"hint,omitempty"`
}

// InstalledKit is a kit as a location has it.
type InstalledKit struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Version     string     `json:"version,omitempty"`
	Source      string     `json:"source,omitempty"`
	Hash        string     `json:"hash,omitempty"`
	Dir         string     `json:"dir"`
	Config      RepoConfig `json:"config"`
	InstalledAt time.Time  `json:"installed_at"`
}

// KitInstall is a kit on its way to a box: the manifest, its files (path →
// base64), where it came from, and a hash of everything for updates.
type KitInstall struct {
	Kit    Kit               `json:"kit"`
	Files  map[string]string `json:"files,omitempty"`
	Source string            `json:"source,omitempty"`
	Hash   string            `json:"hash,omitempty"`
}

// KitResult reports an install.
type KitResult struct {
	Kit      InstalledKit `json:"kit"`
	Warnings []string     `json:"warnings"`
}

// InstalledKitAt is one location's kit, for listing a box's kits.
type InstalledKitAt struct {
	Location string       `json:"location"`
	Slug     string       `json:"slug,omitempty"`
	Kit      InstalledKit `json:"kit"`
}

// Location is a named place on a box where work happens: a repository or any
// directory. Agents and worktrees are created relative to a location.
type Location struct {
	Name string `json:"name"`
	Path string `json:"path"`
	// Repo is true when Path is the root of a git repository.
	Repo      bool       `json:"repo"`
	Worktrees []Worktree `json:"worktrees,omitempty"`
	// Scripts run when berth creates or removes worktrees here.
	Scripts Scripts `json:"scripts"`
	// Agents are the repository's own agent presets.
	Agents []AgentPreset `json:"agents,omitempty"`
	// Remote is origin's URL, Slug its "owner/repo", and DefaultBranch
	// what new branches start from.
	Remote        string `json:"remote,omitempty"`
	Slug          string `json:"slug,omitempty"`
	DefaultBranch string `json:"default_branch,omitempty"`
	// RepoTrust is whether this box runs the repository's
	// .berth/config.json: "none" without one, "trusted", or "untrusted" /
	// "changed" while it waits to be trusted and only its ports apply.
	RepoTrust string `json:"repo_trust,omitempty"`
	// Check is how to tell the work here is right: the config's "check",
	// else one found in the repository (CheckFrom "config" or "detected").
	Check     string `json:"check,omitempty"`
	CheckFrom string `json:"check_from,omitempty"`
}

type Worktree struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Branch string `json:"branch,omitempty"`
	Head   string `json:"head,omitempty"`
	// Main marks the repository's own checkout.
	Main bool `json:"main,omitempty"`
	// SettingUp is true when the tool that made it is still running its
	// setup; a worktree.setup event follows.
	SettingUp bool `json:"setting_up,omitempty"`
	// Port is the first of the worktree's own ports ($BERTH_PORT).
	Port int `json:"port,omitempty"`
	// Locked is set when git has the worktree locked, with LockReason
	// its reason ("initializing" while `git worktree add` runs).
	Locked     bool   `json:"locked,omitempty"`
	LockReason string `json:"lock_reason,omitempty"`
	// Title is the name a person gave the worktree to show in its place
	// (worktreetitles.go): a label only, its branch and folder keep Name.
	Title string `json:"title,omitempty"`
	// Parent identifies the worktree this one is nested under.
	Parent string `json:"parent,omitempty"`
}

// CallerHeader names the agent session that asks for work, from its
// BERTH_SESSION: the box reports back to it. Only callers on the box's own
// socket may name one, and only an agent session is reported to.
const CallerHeader = "X-Berth-Caller"

// Watch is one piece of work a session asked to hear back about.
type Watch struct {
	// ID is what is watched: "turn:<id>", "task:<session>" or "run:<id>".
	ID     string `json:"id"`
	Kind   string `json:"kind"` // turn, task or run
	Parent string `json:"parent"`
	// Session is the child session (turn and task); Turn the turn reported
	// on, once there is one. A task's first turn is the first numbered
	// above After.
	Session string    `json:"session,omitempty"`
	Turn    string    `json:"turn,omitempty"`
	After   int       `json:"after,omitempty"`
	Run     string    `json:"run,omitempty"`
	Created time.Time `json:"created"`
	// Rearmed counts the turns that ended while the child still waited on
	// work of its own: it reports when that is back and its next turn ends.
	Rearmed int `json:"rearmed,omitempty"`
}

// SendRequest types a prompt into a session.
//
// When is "now" (type it at once) or "idle" (hold it in the box's inbox for
// the session, typed once the agent is idle or finished). A request that
// gives When never types into an agent waiting for someone (a permission or
// a question) unless Force: an Enter there would pick an answer for the
// person. Requests without When, from older clients, type at once as
// before. IdemKey makes a retried send return the turn it already made.
type SendRequest struct {
	Text    string `json:"text"`
	Enter   *bool  `json:"enter,omitempty"`
	When    string `json:"when,omitempty"`
	Force   bool   `json:"force,omitempty"`
	IdemKey string `json:"idem_key,omitempty"`
}

// SendResult names the turn a send started or queued, the journal Seq of
// the send, and the box's time, which callers wait from rather than their
// own clock.
type SendResult struct {
	Sent      bool      `json:"sent"`
	Queued    bool      `json:"queued,omitempty"`
	Duplicate bool      `json:"duplicate,omitempty"`
	Turn      string    `json:"turn,omitempty"`
	Seq       int64     `json:"seq,omitempty"`
	At        time.Time `json:"at"`
}

// WaitResult is what an agent was doing when a wait ended.
type WaitResult struct {
	State    string `json:"state"`
	TimedOut bool   `json:"timed_out"`
	// Turn is the turn the state belongs to, when the box keeps turns.
	Turn string `json:"turn,omitempty"`
}

// TurnWait is what a turn wait returns.
type TurnWait struct {
	Turn     Turn   `json:"turn"`
	State    string `json:"state"`
	TimedOut bool   `json:"timed_out"`
}

// ExecRequest runs a command to completion in a location or worktree, such
// as the check a loop runs after each of an agent's turns.
type ExecRequest struct {
	Location string `json:"location"`
	Command  string `json:"command"`
	Timeout  string `json:"timeout,omitempty"`
	// Detach answers at once with a run whose result holds the exit code
	// and output, so no caller blocks (or times out) on a long check.
	Detach bool `json:"detach,omitempty"`
}

type ExecResult struct {
	ExitCode int    `json:"exit_code"`
	Output   string `json:"output"`
	// Truncated is true when only the end of the output is kept.
	Truncated bool `json:"truncated,omitempty"`
}

// PairingInvite is a fresh pairing code and what a new laptop needs with it.
type PairingInvite struct {
	Box         string    `json:"box"`
	Fingerprint string    `json:"fingerprint"`
	Addresses   []string  `json:"addresses"`
	Code        string    `json:"code"`
	Expires     time.Time `json:"expires"`
}

// Port is a TCP port something on the box is listening on.
type Port struct {
	Port    int    `json:"port"`
	Address string `json:"address"`
	PID     int    `json:"pid,omitempty"`
	Process string `json:"process,omitempty"`
	Command string `json:"command,omitempty"`
	// Dir is the process's working directory, which says which worktree a
	// dev server belongs to.
	Dir string `json:"dir,omitempty"`
}

// WorktreeService is a long-running program each worktree runs, such as its dev
// server. It gets the worktree's environment, so it can listen on
// $BERTH_PORT.
type WorktreeService struct {
	Name string `json:"name"`
	Run  string `json:"run"`
	// Autostart starts it when the worktree is created, after setup.
	Autostart bool `json:"autostart,omitempty"`
	// Terminal runs it in a terminal of its own (a tmux session) instead of
	// in the background, which the app shows as a tab: its output live, and
	// Ctrl-C there stops it. Title names that tab; the name does otherwise.
	Terminal bool   `json:"terminal,omitempty"`
	Title    string `json:"title,omitempty"`
}

// Config is a location's config as the app shows and edits it.
type Config struct {
	// Repo is the repository's .berth/config.json as this box applies it,
	// read-only here. Until the file is trusted that is its ports alone;
	// RepoTrust.Wants holds the rest.
	Repo     *RepoConfig `json:"repo"`
	RepoPath string      `json:"repo_path"`
	// RepoTrust says whether this box runs the repository's config.
	RepoTrust RepoTrust `json:"repo_trust"`
	// Kit is the kit installed for the location, if any.
	Kit *InstalledKit `json:"kit,omitempty"`
	// Local is this box's own config for the location.
	Local     RepoConfig `json:"local"`
	Effective RepoConfig `json:"effective"`
}

// Repo trust states.
const (
	// RepoTrustNone: the repository has no .berth/config.json.
	RepoTrustNone = "none"
	// RepoTrustTrusted: this box runs the config as it is.
	RepoTrustTrusted = "trusted"
	// RepoTrustUntrusted: nobody has trusted the config on this box.
	RepoTrustUntrusted = "untrusted"
	// RepoTrustChanged: an earlier version was trusted; this one is not.
	RepoTrustChanged = "changed"
)

// RepoTrust says whether a box runs a repository's committed config.
type RepoTrust struct {
	State string `json:"state"`
	// Hash is the sha256 of the file as it is now; trusting it means
	// sending this hash back.
	Hash string `json:"hash,omitempty"`
	// Wants is everything the committed config would run, set while it is
	// not trusted.
	Wants *RepoConfig `json:"wants,omitempty"`
}

// Pending reports whether the repository asks for something the box does not
// run yet.
func (t RepoTrust) Pending() bool {
	return t.State == RepoTrustUntrusted || t.State == RepoTrustChanged
}

// RunRequest starts a run.
type RunRequest struct {
	Template string         `json:"template,omitempty"`
	Params   map[string]any `json:"params,omitempty"`
	Title    string         `json:"title,omitempty"`
	// Flow is ad-hoc steps instead of a template.
	Flow []runs.Step `json:"flow,omitempty"`
	// FlowID (with Scope) runs one of the box's configured flows now, with
	// Data as its event's data.
	FlowID string         `json:"flow_id,omitempty"`
	Scope  string         `json:"scope,omitempty"`
	Data   map[string]any `json:"data,omitempty"`
	// Session and Path set the scope of ad-hoc steps.
	Session string       `json:"session,omitempty"`
	Path    string       `json:"path,omitempty"`
	Group   string       `json:"group,omitempty"`
	Parent  string       `json:"parent,omitempty"`
	Budget  *runs.Budget `json:"budget,omitempty"`
	// IdemKey is the Idempotency-Key, for callers that cannot send headers
	// (the app, through the laptop's agent).
	IdemKey string `json:"idem_key,omitempty"`
}

// GateDecision decides a gate.
type GateDecision struct {
	Approve bool   `json:"approve"`
	Note    string `json:"note,omitempty"`
	Pick    *int   `json:"pick,omitempty"`
}

// Scripts are a location's worktree lifecycle commands. They get
// BERTH_ROOT_PATH, BERTH_WORKTREE_PATH and BERTH_WORKTREE_NAME, and Orca's
// ORCA_* names for the same values, so a script written for Orca runs
// unchanged.
type Scripts struct {
	Setup   string `json:"setup,omitempty"`
	Archive string `json:"archive,omitempty"`
	// From says where the scripts came from: "berth" when set on the
	// location, "kit" from its kit, "repo" from the repository's
	// .berth/config.json.
	From string `json:"from,omitempty"`
}

// RepoConfigFile is where a repository describes how berth sets up its
// worktrees, committed alongside the code so every box does the same.
const RepoConfigFile = ".berth/config.json"

// RepoConfig is a repository's .berth/config.json.
type RepoConfig struct {
	Setup   string `json:"setup,omitempty"`
	Archive string `json:"archive,omitempty"`
	// Check is the command that says the work is right ("pnpm test && pnpm
	// lint"): what Try N ways and loops verify with unless told otherwise.
	Check string `json:"check,omitempty"`
	// Agents adds ways to start agents here, or replaces built-ins by ID,
	// e.g. {"id": "claude", "command": "claude --model opus"}.
	Agents []AgentPreset `json:"agents,omitempty"`
	// Ports is how many ports each worktree needs ($BERTH_PORT,
	// $BERTH_PORT_1, …). Every worktree has at least one.
	Ports int `json:"ports,omitempty"`
	// Env is added to everything run in a worktree, with $BERTH_* expanded:
	// {"DATABASE_URL": "postgres://localhost/$BERTH_WORKTREE_SLUG"}.
	Env map[string]string `json:"env,omitempty"`
	// Services run in every worktree, such as its dev server.
	Services []WorktreeService `json:"services,omitempty"`
	// Hooks run for this repository's events only, in the worktree.
	Hooks []hooks.Hook `json:"hooks,omitempty"`
	// Flows are automations for this repository's worktrees.
	Flows []Flow `json:"flows,omitempty"`
	// BrowserAllow asks for public origins an agent's browser may load in
	// this repository's worktrees (a sign-in provider, say). It applies once
	// the box trusts the repository's config.
	BrowserAllow []string `json:"browser_allow,omitempty"`
	// Shots is what `berthd shots compare` screenshots and diffs by
	// default: pages, sizes, and selectors to mask.
	Shots *ShotsConfig `json:"shots,omitempty"`
}

// SecretReport is what `berthd secret exec` tells the box after resolving a
// session's or service's references in its own process: which resolved, and
// which failed and why. Never a value.
type SecretReport struct {
	Location string         `json:"location"`
	Name     string         `json:"name"`
	Path     string         `json:"path"`
	Results  []SecretResult `json:"results"`
}

type SecretResult struct {
	Variable string `json:"variable"`
	Ref      string `json:"ref"`
	// Reason is why it could not be resolved; empty when it was.
	Reason string `json:"reason,omitempty"`
}

// SecretTest is what testing a reference reports: whether it resolved, and
// the value's length, never the value.
type SecretTest struct {
	OK     bool   `json:"ok"`
	Length *int   `json:"length,omitempty"`
	Error  string `json:"error,omitempty"`
}

// Service is a listening port that belongs to a worktree, found by where its
// process runs: Next.js in ~/work/shop-checkout/apps/web serves shop/checkout.
type Service struct {
	Location string `json:"location"`
	Worktree string `json:"worktree"`
	Path     string `json:"path"`
	Port     int    `json:"port"`
	Process  string `json:"process,omitempty"`
	// Main marks the location's own checkout, reachable as LOCATION.BOX.
	Main bool `json:"main,omitempty"`
}

// Session is a long-running program, usually a coding agent, started at a
// location on the box. It keeps running when no one is attached.
type Session struct {
	Name     string    `json:"name"`
	Location string    `json:"location,omitempty"`
	Dir      string    `json:"dir"`
	Command  string    `json:"command,omitempty"`
	Created  time.Time `json:"created"`
	Attached int       `json:"attached"`
	Exited   bool      `json:"exited"`
	// Agent is the coding agent the command runs, if any, and AgentState
	// what its hooks said last: idle, running, waiting, or finished.
	Agent      string    `json:"agent,omitempty"`
	AgentState string    `json:"agent_state,omitempty"`
	StateSince time.Time `json:"state_since,omitzero"`
	// Preset is the agent preset the session was started with, which berth
	// keeps (@berth_agent) so a wrapped command is still known as an agent.
	Preset string `json:"preset,omitempty"`
	// Turn is the agent's current (or last) turn, StateSeq the journal Seq
	// of its state, and Fidelity how well berth knows it: hooks, partial or
	// screen.
	Turn     string `json:"turn,omitempty"`
	StateSeq int64  `json:"state_seq,omitempty"`
	Fidelity string `json:"fidelity,omitempty"`
	// Title names the work: the first line of the prompt it started with
	// (or the first one it was sent), or what someone renamed it to. Kept
	// as @berth_title; empty until there is one.
	Title string `json:"title,omitempty"`
	// Queued is how many prompts the box holds for the agent until it is
	// idle (GET .../queue lists them); Ask is what it waits on, from its
	// hooks, when they said.
	Queued int  `json:"queued,omitempty"`
	Ask    *Ask `json:"ask,omitempty"`
	// Service is set on a worktree service's own terminal (a service with
	// "terminal": true): the service's name, kept as @berth_service. It is
	// never an agent, whatever it runs.
	Service string `json:"service,omitempty"`

	// Scope is the systemd scope unit the session runs in; Usage describes
	// the processes it owns.
	Scope string     `json:"scope,omitempty"`
	Usage *ProcUsage `json:"usage,omitempty"`

	// PanePID is box-side process bookkeeping and never crosses the wire.
	PanePID int `json:"-"`

	// CommandFile is box-side bookkeeping for its stored command. It never
	// crosses the wire.
	CommandFile string `json:"-"`
}

// Share makes one port on the box public through a Cloudflare quick tunnel.
// It is the only way anything becomes public, it exists only on request, and
// it ends when revoked or when berthd stops. The box runs the tunnel, so a
// shared link keeps working while the laptop sleeps.
type Share struct {
	ID      string    `json:"id"`
	Port    int       `json:"port"`
	URL     string    `json:"url"`
	Started time.Time `json:"started"`
	State   string    `json:"state"`
	Error   string    `json:"error,omitempty"`
}

// SkillTargets is a skill's state for each agent tool in one place.
type SkillTargets map[string]integrations.SkillState

// SkillRow is one skill and where it is installed.
type SkillRow struct {
	integrations.SkillInfo
	User    SkillTargets `json:"user"`
	Project SkillTargets `json:"project,omitempty"`
	// Excluded is, per agent, whether the project copy is kept out of git.
	Excluded map[string]bool `json:"excluded,omitempty"`
}

type SkillsReport struct {
	Agents []string `json:"agents"`
	// UserDirs and ProjectDirs are where each agent's skills go.
	UserDirs    map[string]string `json:"user_dirs"`
	ProjectDirs map[string]string `json:"project_dirs,omitempty"`
	Location    string            `json:"location,omitempty"`
	Skills      []SkillRow        `json:"skills"`
}

// SkillsRequest installs or removes skills.
type SkillsRequest struct {
	// Skills are names, or ["all"].
	Skills []string `json:"skills"`
	// Agent is claude, codex, or all.
	Agent string `json:"agent"`
	// Target is user or project; project needs Location.
	Target   string `json:"target"`
	Location string `json:"location,omitempty"`
	// Commit leaves project skills visible to git, to be committed and
	// shared; by default they are listed in .git/info/exclude.
	Commit bool `json:"commit,omitempty"`
}

// UnmarshalJSON accepts "skills": "all" as well as a list.
func (r *SkillsRequest) UnmarshalJSON(b []byte) error {
	type plain SkillsRequest
	var raw struct {
		plain
		Skills json.RawMessage `json:"skills"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	*r = SkillsRequest(raw.plain)
	if len(raw.Skills) > 0 {
		var one string
		if json.Unmarshal(raw.Skills, &one) == nil {
			r.Skills = []string{one}
		} else if err := json.Unmarshal(raw.Skills, &r.Skills); err != nil {
			return err
		}
	}
	return nil
}

// Stats is a box at a glance: how loaded it is, and what its agents are doing.
type Stats struct {
	Hostname string    `json:"hostname"`
	Uptime   int64     `json:"uptime_s,omitempty"`
	CPUs     int       `json:"cpus"`
	Load     []float64 `json:"load,omitempty"`
	Memory   Usage     `json:"memory"`
	Swap     Usage     `json:"swap"`
	Disks    []Disk    `json:"disks"`
	Agents   []Agent   `json:"agents"`
	// Hooks is true when an agent tool on the box reports to berthd, so
	// an agent's waiting or finished state is known.
	Hooks bool `json:"hooks"`
}

// Usage is bytes in use out of a total.
type Usage struct {
	Total uint64 `json:"total"`
	Used  uint64 `json:"used"`
}

type Disk struct {
	Mount string `json:"mount"`
	Usage
}

// Agent is a coding agent process running on the box.
type Agent struct {
	Tool     string `json:"tool"`
	PID      int    `json:"pid"`
	Path     string `json:"path,omitempty"`
	Location string `json:"location,omitempty"`
	Worktree string `json:"worktree,omitempty"`
	// State is "idle", "waiting" or "finished" when its hooks said so
	// last, and "running" otherwise.
	State string    `json:"state"`
	Since time.Time `json:"since,omitempty"`
}

// AgentPreset is a way to start a coding agent: what the app offers when it
// starts one, and what a task runs.
type AgentPreset struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Command string `json:"command"`
	// PromptFlag passes a first prompt; empty means it is the last argument.
	PromptFlag string `json:"prompt_flag,omitempty"`
	// ModelFlag passes a model ("--model"); empty means berth offers no
	// model choice for this agent.
	ModelFlag string `json:"model_flag,omitempty"`
	// EffortFlag passes an effort: a flag ("--effort"), or a word ending in
	// "=" that takes the value with no space ("-c model_reasoning_effort=").
	EffortFlag string `json:"effort_flag,omitempty"`
	// Models and Efforts are what the app offers, as the CLI's own names
	// (aliases where it has them, so the list does not go stale). Leaving one
	// out means the CLI's default. A repository's .berth/config.json can set
	// them for a built-in agent by giving its id and no command.
	Models  []string `json:"models,omitempty"`
	Efforts []string `json:"efforts,omitempty"`
}

// TaskRequest makes a worktree and starts an agent in it, in one step.
type TaskRequest struct {
	Location string `json:"location"`
	Name     string `json:"name"`
	Branch   string `json:"branch,omitempty"`
	Base     string `json:"base,omitempty"`
	PR       int    `json:"pr,omitempty"`
	Ref      string `json:"ref,omitempty"`
	// Agent is a preset ID; Command, when set, is run instead.
	Agent   string `json:"agent,omitempty"`
	Command string `json:"command,omitempty"`
	Prompt  string `json:"prompt,omitempty"`
	// Model and Effort pick the agent's model and effort, by the CLI's own
	// names (see AgentPreset); empty is the CLI's default.
	Model  string `json:"model,omitempty"`
	Effort string `json:"effort,omitempty"`
	// FromSession names the session handing this work off, if any.
	FromSession string `json:"from_session,omitempty"`
	// Open asks the app to show the new session: "split" or "tab".
	Open string `json:"open,omitempty"`
	// Title names the work; without one, the prompt's first line does.
	Title string `json:"title,omitempty"`
}

type Task struct {
	Worktree Worktree `json:"worktree"`
	Session  Session  `json:"session"`
}

// TeamBundle is a team setup on its way to a box: what the laptop read
// through its own gh at the commit the engineer reviewed, so the box needs
// no GitHub access for .berth itself. Repositories the box clones with its
// own gh sign-in (the "github" step).
type TeamBundle struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Org    string `json:"org"`
	Commit string `json:"commit"`
	// Script runs the steps (team.Box.Script, inside Files).
	Script string      `json:"script,omitempty"`
	Steps  []team.Step `json:"steps"`
	// GitHub adds Burf's own step: gh auth login on the box.
	GitHub bool `json:"github"`
	// OnePassword adds Burf's other step, after GitHub, when the keys are
	// 1Password references: op signed in on the box, in its terminal.
	OnePassword bool `json:"onepassword,omitempty"`
	// OnePasswordSkipped says the engineer skipped 1Password: the shared
	// keys' references are kept aside (each project's Deferred), op is
	// never called for them, and Use 1Password puts them back later.
	OnePasswordSkipped bool `json:"onepassword_skipped,omitempty"`
	// Agents adds Burf's agents step, after the team's own: these agent
	// CLIs installed on the box, with their hooks and skills.
	Agents []string `json:"agents,omitempty"`
	// Settings are team.json's box.settings, which the script (and each
	// project's init) gets as BERTH_SETTING_<NAME>.
	Settings map[string]string `json:"settings,omitempty"`
	// Files are .berth's files at Commit, path → base64.
	Files    map[string]string `json:"files"`
	Projects []TeamProjectPlan `json:"projects"`
	// Start, when set, starts from that step rather than the first.
	Start string `json:"start,omitempty"`
}

// TeamProjectPlan is one repository to clone and set up.
type TeamProjectPlan struct {
	ID   string `json:"id"`
	Repo string `json:"repo"`
	// URL is what git clones; the box's gh sign-in authenticates it.
	URL      string `json:"url"`
	Path     string `json:"path"`
	Required bool   `json:"required,omitempty"`
	// Source is "repo", "kit" or "none".
	Source string `json:"source"`
	// TrustHash is the sha256 of the repository's .berth/config.json the
	// engineer reviewed: the clone's file is trusted only if it is that one.
	TrustHash string      `json:"trust_hash,omitempty"`
	Kit       *KitInstall `json:"kit,omitempty"`
	// Init, a path inside the bundle's files, runs once in the clone.
	Init      string `json:"init,omitempty"`
	FirstTask string `json:"first_task,omitempty"`
	// Env is laid into the project's own config on this box: secret
	// references for shared keys, and the values the engineer typed.
	Env map[string]string `json:"env,omitempty"`
	// Keys are the names of every key the team lists for the project
	// (shared and asked), so the box can say which are still missing.
	Keys []string `json:"keys,omitempty"`
	// Deferred are the shared keys' 1Password references, name → op://…,
	// when the engineer skipped 1Password: not in the project's config, so
	// nothing reads them with op, until Use 1Password lays them in.
	Deferred map[string]string `json:"deferred,omitempty"`
}

// Team step and project states.
const (
	TeamTodo      = "todo"
	TeamRunning   = "running"
	TeamWaiting   = "waiting"
	TeamDone      = "done"
	TeamSkipped   = "skipped"
	TeamFailed    = "failed"
	TeamQueued    = "queued"
	TeamCloning   = "cloning"
	TeamSettingUp = "setting-up"
	TeamReady     = "ready"
)

// TeamStatus is how a team setup stands on a box.
type TeamStatus struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Org    string `json:"org"`
	Commit string `json:"commit"`
	Box    string `json:"box"`
	// Phase is steps, projects, done or failed.
	Phase string `json:"phase"`
	// Session is the box terminal the steps run in.
	Session  string              `json:"session,omitempty"`
	Steps    []TeamStepStatus    `json:"steps"`
	Projects []TeamProjectStatus `json:"projects"`
	// KeysSet are "project/KEY" the box has a value or reference for.
	KeysSet []string `json:"keys_set"`
	// OnePasswordSkipped says 1Password was skipped for the shared keys,
	// which Use 1Password (POST /v1/team/{id}/onepassword) can undo.
	OnePasswordSkipped bool      `json:"onepassword_skipped,omitempty"`
	Started            time.Time `json:"started"`
	Updated            time.Time `json:"updated"`
	Error              string    `json:"error,omitempty"`
}

type TeamStepStatus struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Sudo  bool   `json:"sudo"`
	State string `json:"state"`
	Secs  int    `json:"secs,omitempty"`
	Error string `json:"error,omitempty"`
	// Code and URL are GitHub's device code while the github step waits.
	Code    string     `json:"code,omitempty"`
	URL     string     `json:"url,omitempty"`
	Started *time.Time `json:"started,omitempty"`
}

type TeamProjectStatus struct {
	ID       string   `json:"id"`
	Repo     string   `json:"repo"`
	State    string   `json:"state"`
	Location string   `json:"location,omitempty"`
	Error    string   `json:"error,omitempty"`
	Trust    string   `json:"trust,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
	// Line is the latest line of what it is doing (git's progress, then its
	// init terminal's last line).
	Line string `json:"line,omitempty"`
	// Session is the terminal its init runs in, and Waiting says that
	// terminal waits for an answer (a [Y/n], a password): the project is
	// not ready until someone gives it there.
	Session string `json:"session,omitempty"`
	Waiting bool   `json:"waiting,omitempty"`
	// Keys are the names of the keys the team lists for it; Missing, those
	// its config on this box has no value for yet (left blank when asked),
	// to add in Project settings. Missing is worked out when read.
	Keys    []string `json:"keys,omitempty"`
	Missing []string `json:"missing,omitempty"`
	// Deferred are the keys 1Password would give it, while skipped.
	Deferred []string `json:"deferred,omitempty"`
}

// WorktreeRequest asks for a new git worktree at a location.
type WorktreeRequest struct {
	Name   string `json:"name"`
	Branch string `json:"branch,omitempty"`
	Base   string `json:"base,omitempty"`
	// PR and Ref check out a pull or merge request: Ref (by default
	// pull/<PR>/head) is fetched into Branch when origin has no such branch.
	PR  int    `json:"pr,omitempty"`
	Ref string `json:"ref,omitempty"`
	// Parent identifies the worktree this one is nested under.
	Parent string `json:"parent,omitempty"`
}

// Turn is one prompt-to-end-of-turn of one agent session.
type Turn struct {
	ID      string `json:"id"` // "<session>#<n>"
	Session string `json:"session"`
	Agent   string `json:"agent,omitempty"`
	N       int    `json:"n"`
	// Origin says who prompted: laptop:<peer>, flow:<id>, phone, terminal.
	Origin string `json:"origin,omitempty"`
	// SentSeq is the journal Seq of the send (0 if typed by a person),
	// Sent its time.
	SentSeq int64     `json:"sent_seq,omitempty"`
	Sent    time.Time `json:"sent,omitzero"`
	EndSeq  int64     `json:"end_seq,omitempty"`
	// State is queued (held in the inbox), pending (sent, not started),
	// running, waiting, finished, exited or lost.
	State   string    `json:"state"`
	Queued  time.Time `json:"queued,omitzero"`
	Started time.Time `json:"started,omitzero"`
	Ended   time.Time `json:"ended,omitzero"`
	// Waits are the spans it spent waiting for a person.
	Waits []Span `json:"waits,omitempty"`
	// Fidelity is how well berth knows its edges: hooks (the agent said),
	// partial (it started when sent, as the agent cannot say) or screen.
	Fidelity string `json:"fidelity,omitempty"`
	IdemKey  string `json:"idem_key,omitempty"`
	// Status is "error" for a turn the agent ended on a failure.
	Status string `json:"status,omitempty"`
}

// Span is a time the agent waited for someone.
type Span struct {
	Start  time.Time `json:"start"`
	End    time.Time `json:"end,omitzero"`
	Reason string    `json:"reason,omitempty"`
	// Ask is what the agent asked for, from its own hooks, when it said.
	Ask *Ask `json:"ask,omitempty"`
}

// Ask is a waiting agent's request, from its hooks rather than its screen:
// the tool it wants to use, a short summary of the input (the command, or
// the file's path; never what it would write), its reason, and the
// message it showed. Each is at most adapters.AskLimit long. It is kept
// only here, in the ledger's private file: never in events.
type Ask struct {
	Tool    string `json:"tool,omitempty"`
	Input   string `json:"input,omitempty"`
	Why     string `json:"why,omitempty"`
	Message string `json:"message,omitempty"`
}

// Unit is a long-lived program berthd runs on the box under the platform's
// service manager, so it survives reboots and restarts on failure. Its output
// goes to a file berthd owns rather than the journal, because a program's
// output can contain credentials.
type Unit struct {
	Name    string `json:"name"`
	State   string `json:"state"`
	LogPath string `json:"log_path"`
}

type UnitRequest struct {
	Name    string            `json:"name"`
	Program string            `json:"program"`
	Args    []string          `json:"args"`
	Env     map[string]string `json:"env"`
}

// ShotsConfig is .berth/config.json's "shots": what to compare by default.
// The box keeps its own copy with behaviour; the two stay field for field.
type ShotsConfig struct {
	// Pages are paths, "/" first: ["/", "/login", "/pricing"].
	Pages []string `json:"pages,omitempty"`
	// Sizes are viewport widths in CSS pixels (default 375, 768, 1280).
	Sizes []int `json:"sizes,omitempty"`
	// Mask hides dynamic content from the diff: CSS selectors, such as
	// "time", "[data-testid=avatar]", ".relative-date".
	Mask []string `json:"mask,omitempty"`
	// Threshold is the colour distance (0-1) under which two pixels are
	// the same (default 0.03: both sides render in one Chromium, so there
	// is no cross-machine noise to forgive, and pixelmatch's 0.1 misses a
	// white card moving over an off-white page).
	Threshold float64 `json:"threshold,omitempty"`
	// Unchanged is the share of changed pixels, in percent, under which a
	// shot counts as unchanged (default 0.02).
	Unchanged float64 `json:"unchanged_below,omitempty"`
	// MaxHeight caps a full-page shot, in CSS pixels (default 4000).
	MaxHeight int `json:"max_height,omitempty"`
	// Scale is the device pixel ratio (default 1).
	Scale float64 `json:"scale,omitempty"`
	// ColorScheme is the prefers-color-scheme pages see: light (default),
	// dark, or both (every shot twice).
	ColorScheme string `json:"color_scheme,omitempty"`
	// WaitFor is a selector every page must show before its shot.
	WaitFor string `json:"wait_for,omitempty"`
	// Seed makes Math.random repeat the same numbers on every load.
	Seed bool `json:"seed_random,omitempty"`
	// Parallel caps the browser tabs shooting at once (default: one per
	// side, size and scheme, at most the box's CPUs and 8).
	Parallel int `json:"parallel,omitempty"`
}

// AgentPath is one agent CLI as a box has it: where, which version, and
// how it was installed, for Settings › Boxes and doctor.
type AgentPath struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Command string `json:"command"`
	Path    string `json:"path"`
	Version string `json:"version,omitempty"`
	// Install is "npm", "Homebrew", "bun", "volta", "pnpm" or "".
	Install string `json:"install,omitempty"`
	// Via is "shell", "path" or "dir" (agentpath.Found).
	Via string `json:"via,omitempty"`
}

// Info describes the running daemon, so a laptop can pick the right build to
// upload and tell whether the box already runs it.
type Info struct {
	Name  string `json:"name"`
	OS    string `json:"os"`
	Arch  string `json:"arch"`
	Build string `json:"build"`
	// User and Home are the account berthd runs as, which is the one to
	// log in as over SSH, for editors.
	User  string   `json:"user,omitempty"`
	Home  string   `json:"home,omitempty"`
	Tools []string `json:"tools"`
	// Agents are the agent presets this box can start.
	Agents []AgentPreset `json:"agents"`
	// AgentPaths say where each built-in agent's CLI was found.
	AgentPaths []AgentPath `json:"agent_paths,omitempty"`
	// Capabilities name the API features this box has, so clients can use
	// them when present: "turns" (turn IDs from send, turn waits),
	// "journal" (GET /v1/events?since=SEQ).
	Capabilities []string `json:"capabilities"`
	// Adapters say what each agent can report, for the app.
	Adapters map[string]adapters.Caps `json:"adapters,omitempty"`
}

// ServiceStatus is one of a worktree's services.
type ServiceStatus struct {
	Name      string `json:"name"`
	Run       string `json:"run"`
	Autostart bool   `json:"autostart,omitempty"`
	// State is the unit's, or "stopped" when it is not installed.
	State string `json:"state"`
	Unit  string `json:"unit"`
	Port  int    `json:"port,omitempty"`
	// Terminal services run in Session, a tmux session the app shows as a
	// tab named Title (the name when the config gives none).
	Terminal bool   `json:"terminal,omitempty"`
	Title    string `json:"title,omitempty"`
	Session  string `json:"session,omitempty"`
}

// Merge lays local over repo, as a box does with its own config.
func Merge(repo, local RepoConfig) RepoConfig { return merge(repo, local) }

// merge lays local over repo: scalars and env entries replace, services and
// agents replace by name, and hooks add up.
func merge(repo, local RepoConfig) RepoConfig {
	out := repo
	if local.Setup != "" {
		out.Setup = local.Setup
	}
	if local.Archive != "" {
		out.Archive = local.Archive
	}
	if local.Check != "" {
		out.Check = local.Check
	}
	if local.Ports != 0 {
		out.Ports = local.Ports
	}
	if len(local.Env) > 0 {
		out.Env = map[string]string{}
		for k, v := range repo.Env {
			out.Env[k] = v
		}
		for k, v := range local.Env {
			out.Env[k] = v
		}
	}
	out.Services = mergeBy(repo.Services, local.Services, func(s WorktreeService) string { return s.Name })
	out.Agents = mergeBy(repo.Agents, local.Agents, func(a AgentPreset) string { return a.ID })
	out.Hooks = append(append([]hooks.Hook{}, repo.Hooks...), local.Hooks...)
	out.Flows = mergeBy(repo.Flows, local.Flows, func(f Flow) string { return f.ID })
	out.BrowserAllow = append(append([]string{}, repo.BrowserAllow...), local.BrowserAllow...)
	if local.Shots != nil {
		out.Shots = local.Shots
	}
	return out
}

func mergeBy[T any](base, over []T, key func(T) string) []T {
	out := append([]T{}, base...)
	for _, o := range over {
		replaced := false
		for i := range out {
			if key(out[i]) == key(o) {
				out[i], replaced = o, true
			}
		}
		if !replaced {
			out = append(out, o)
		}
	}
	return out
}

// GitProtocols are the transports a clone may use. Pinning them keeps a
// link from reaching git's ext:: (a command) or file:: helpers, whatever git
// version or environment the box has. Tests add file.
var GitProtocols = "https:http:ssh:git"

// BuildID identifies a daemon build by its bytes.
func BuildID(binary []byte) string { return version.BuildID(binary) }

var validOrigin = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

// ValidOrigin reports whether origin can be sent in a box request header.
func ValidOrigin(origin string) bool { return validOrigin.MatchString(origin) }

// ProcUsage is what a session's processes use, from its scope's cgroup
// or, without one, summed over the processes berth finds for it.
type ProcUsage struct {
	// Memory is in bytes: the cgroup's memory.current (page cache
	// included, as its ceiling counts it), or resident memory summed.
	Memory uint64 `json:"memory"`
	// MemoryHigh is its ceiling, 0 for none.
	MemoryHigh uint64 `json:"memory_high,omitempty"`
	// CPUSeconds is the processor time it has used; CPUPercent how busy it
	// is now (100 is one core), when known.
	CPUSeconds float64 `json:"cpu_s"`
	CPUPercent float64 `json:"cpu_percent,omitempty"`
	Processes  int     `json:"processes,omitempty"`
	// NearLimit is set from 90% of its ceiling; Throttled counts the
	// times the kernel held it back at the ceiling.
	NearLimit bool   `json:"near_limit,omitempty"`
	Throttled uint64 `json:"throttled,omitempty"`
	// Scoped says the numbers are its cgroup's.
	Scoped bool `json:"scoped,omitempty"`
}

// BoxBrowser is one browser: its main process and every helper under it.
type BoxBrowser struct {
	// ID names it for POST /v1/processes/{id}/stop.
	ID string `json:"id"`
	// Engine is Chromium, Headless Chromium, Chrome, Edge or Firefox.
	Engine string `json:"engine"`
	// Owner is one of the Owner constants; Label says it in words
	// ("Playwright tests in cal/billing").
	Owner string `json:"owner"`
	Label string `json:"label"`
	// Via is what drives it, when that shows: Playwright, Puppeteer,
	// agent-browser, Cypress, ….
	Via string `json:"via,omitempty"`
	// Session is the berth session it belongs to, Location and Worktree
	// where (for berth's own browser, the worktree's).
	Session  string `json:"session,omitempty"`
	Location string `json:"location,omitempty"`
	Worktree string `json:"worktree,omitempty"`
	// PID is its main process; Processes how many it has.
	PID       int   `json:"pid"`
	PIDs      []int `json:"pids"`
	Processes int   `json:"processes"`
	// CPUPercent (100 is one core) and Memory (resident, bytes) are summed
	// over its processes.
	CPUPercent float64   `json:"cpu_percent"`
	Memory     uint64    `json:"memory"`
	Started    time.Time `json:"started,omitzero"`
	Exe        string    `json:"exe,omitempty"`
	// Stoppable is false for a browser Burf did not start.
	Stoppable bool `json:"stoppable"`
}

// BoxSessionProcs is what one session's processes use.
type BoxSessionProcs struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Location string    `json:"location,omitempty"`
	Title    string    `json:"title,omitempty"`
	Agent    string    `json:"agent,omitempty"`
	Scope    string    `json:"scope,omitempty"`
	Usage    ProcUsage `json:"usage"`
}

// BoxProcesses is GET /v1/processes.
type BoxProcesses struct {
	Browsers []BoxBrowser      `json:"browsers"`
	Sessions []BoxSessionProcs `json:"sessions,omitempty"`
	// Scopes says new sessions on this box get a systemd scope.
	Scopes bool      `json:"scopes"`
	At     time.Time `json:"at"`
}
