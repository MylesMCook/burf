// The JSON the laptop agent and boxes speak, as docs/reference/app-api.mdx describes it.
// Field names follow the Go structs exactly; the app and plugins share these.

export type BoxState = "connecting" | "online" | "offline" | "untrusted";

export interface BoxStatus {
  name: string;
  address: string;
  network?: string;
  fingerprint: string;
  state: BoxState;
  error?: string;
  latency_ms?: number;
  since: string;
  // A box on this computer itself (Use this Mac).
  local?: boolean;
}

export interface Forward {
  id: string;
  box: string;
  local: number;
  remote: number;
  pin?: string;
}

export interface ForwardStatus extends Forward {
  state: "listening" | "failed" | string;
  error?: string;
}

export interface Route {
  pattern: string;
  box: string;
  port: number;
}

export interface Status {
  boxes: BoxStatus[];
  forwards: ForwardStatus[];
  routes: Route[];
  proxy: { port: number; url_port: number; error?: string };
}

export interface Worktree {
  name: string;
  path: string;
  branch?: string;
  head?: string;
  main?: boolean;
  setting_up?: boolean;
  // The first of the worktree's own ports ($BERTH_PORT).
  port?: number;
}

export interface Scripts {
  setup?: string;
  archive?: string;
  from?: "berth" | "repo";
}

export interface Location {
  name: string;
  path: string;
  repo: boolean;
  worktrees?: Worktree[];
  scripts: Scripts;
  // Agents the repository's .berth/config.json defines.
  agents?: AgentPreset[];
  // The origin remote's URL, its owner/name on a forge ("acme/shop"), and
  // the branch new worktrees start from by default.
  remote?: string;
  slug?: string;
  default_branch?: string;
  // Whether the box runs the repository's .berth/config.json: "none"
  // without one, "trusted", or "untrusted" / "changed" while it waits for
  // someone to trust it (only its port count applies until then).
  repo_trust?: "none" | "trusted" | "untrusted" | "changed";
}

// What an agent's hooks said last: "idle" is an agent that is open but has
// not been given anything yet.
export type AgentState = "idle" | "running" | "waiting" | "finished";

export interface Session {
  name: string;
  location?: string;
  dir: string;
  command?: string;
  created: string;
  attached: number;
  exited: boolean;
  agent?: string;
  agent_state?: AgentState;
  // When agent_state last changed.
  state_since?: string;
  // The agent preset the session was started with, when berth started it
  // with one (kept even when the command wraps the agent).
  preset?: string;
  // The agent's current (or last) turn ("shop-feat-a-claude#3"), the
  // journal seq of its state, and how well berth knows it: "hooks" (the
  // agent said), "partial" (its turn starts when berth sends) or "screen".
  turn?: string;
  state_seq?: number;
  fidelity?: "hooks" | "partial" | "screen" | string;
  // How many prompts the box holds for the agent until it is idle (boxes
  // with the "queue" capability list them: GET sessions/{name}/queue).
  queued?: number;
  // What the agent waits on, from its own hooks ("ask" capability), while
  // agent_state is "waiting".
  ask?: Ask;
  // What the work is called: the first line of the prompt it started with
  // (or the first it was sent), about 48 characters, or what someone renamed
  // it to. Absent until there is one; api.renameSession names it.
  title?: string;
}

// A waiting agent's request, from its hooks rather than its screen: the
// tool, a short summary of its input (the command, or the file's path;
// never what it would write), its reason, and the message it showed. Each
// is at most 300 characters.
export interface Ask {
  tool?: string;
  input?: string;
  why?: string;
  message?: string;
}

// A prompt the box holds for an agent until it is idle: the start of its
// text (preview) and its full length.
export interface QueuedPrompt {
  turn: string;
  preview: string;
  length: number;
  origin?: string;
  at: string;
}

// A turn is one prompt to the end of the agent's reply. Boxes whose info
// lists the "turns" capability keep them.
export interface Turn {
  // "<session>#<n>"; URL-encode it in paths (# is %23).
  id: string;
  session: string;
  agent?: string;
  n: number;
  // Who prompted: laptop:<name>, flow:<id>, phone, terminal.
  origin?: string;
  sent_seq?: number;
  end_seq?: number;
  // queued (held until the agent is idle), pending (sent, not started yet),
  // running, waiting, finished, exited or lost (status says why: "cancelled"
  // for a held prompt someone cancelled).
  state: "queued" | "pending" | "running" | "waiting" | "finished" | "exited" | "lost" | string;
  queued?: string;
  started?: string;
  ended?: string;
  // Times it waited for someone (a permission or a question).
  waits?: { start: string; end?: string; reason?: string; ask?: Ask }[];
  fidelity?: "hooks" | "partial" | "screen" | string;
  idem_key?: string;
  // "error" when the agent ended the turn on a failure.
  status?: string;
}

// What sending a prompt did. turn and seq come from boxes that keep turns;
// at is always the box's own clock, which a following wait counts from.
export interface SendResult {
  sent: boolean;
  // Held in the box's inbox until the agent is idle (when: "idle").
  queued?: boolean;
  // A retry with an idem_key already used: nothing was typed again.
  duplicate?: boolean;
  turn?: string;
  seq?: number;
  at: string;
}

// What a turn wait returns.
export interface TurnWait {
  turn: Turn;
  state: Turn["state"];
  timed_out: boolean;
}

// What an agent adapter can report: a box's info lists them.
export interface AdapterCaps {
  ready: boolean;
  started: boolean;
  waiting: boolean;
  finished: boolean;
  final_message: boolean;
  via: "hooks" | "notify" | "plugin" | "screen" | string;
}

export interface Usage {
  total: number;
  used: number;
}

export interface BoxAgent {
  tool: string;
  pid: number;
  path?: string;
  location?: string;
  worktree?: string;
  state: AgentState;
  since?: string;
}

export interface Stats {
  hostname: string;
  uptime_s?: number;
  cpus: number;
  load?: number[];
  memory: Usage;
  swap: Usage;
  disks: (Usage & { mount: string })[];
  agents: BoxAgent[];
  hooks: boolean;
}

export interface Service {
  location: string;
  worktree: string;
  path: string;
  port: number;
  process?: string;
  main?: boolean;
}

export interface Port {
  port: number;
  address: string;
  pid?: number;
  process?: string;
  command?: string;
  dir?: string;
}

export interface Share {
  id: string;
  port: number;
  url: string;
  started: string;
  state: string;
  error?: string;
}

// An agent a box can start: claude, codex, or one a template defines.
export interface AgentPreset {
  id: string;
  name: string;
  command: string;
  // How the agent takes a starting prompt, when it needs a flag for it.
  prompt_flag?: string;
  // How it takes a model and an effort, when berth knows. A preset without
  // one offers no choice of it.
  model_flag?: string;
  effort_flag?: string;
  // The models and efforts to offer, by the CLI's own names (aliases where
  // it has them). Leaving one out means the CLI's default.
  models?: string[];
  efforts?: string[];
}

export interface BoxInfo {
  name?: string;
  version?: string;
  os?: string;
  arch?: string;
  build?: string;
  tools?: string[];
  agents?: AgentPreset[];
  // Optional API features: "turns" (send returns a turn; turn waits),
  // "journal" (events carry a seq; GET events?since=SEQ replays).
  capabilities?: string[];
  adapters?: Record<string, AdapterCaps>;
}

export interface Check {
  area: string;
  name: string;
  status: "ok" | "warn" | "fail" | "info" | string;
  detail?: string;
  fix?: string;
}

export interface BerthEvent {
  // The box journal's number for the event, in order (boxes with "journal").
  seq?: number;
  type: string;
  time: string;
  box?: string;
  origin?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface TaskRequest {
  location: string;
  // The session this task continues, for a handoff.
  from_session?: string;
  // A pull request number: the worktree checks out its head.
  pr?: number;
  // The ref to fetch for it, such as pull/9035/head or merge-requests/42/head.
  ref?: string;
  name: string;
  branch?: string;
  base?: string;
  agent?: string;
  command?: string;
  prompt?: string;
  // The agent's model and effort, by the CLI's own names (an agent's
  // `models` and `efforts`); unset is the CLI's default. Only with `agent`.
  model?: string;
  effort?: string;
  // What to call the work; without it, the prompt's first line.
  title?: string;
  // Asks the app to show the new agent: as a tab of its worktree when the
  // person is looking at it, otherwise as a toast that opens it.
  open?: "split" | "tab";
}

export interface TaskResult {
  worktree: Worktree;
  session: Session;
}

// An input a template asks for; {{id}} in its prompt or branch is replaced
// with what was typed.
export interface TemplateVariable {
  id: string;
  label?: string;
  multiline?: boolean;
  default?: string;
}

// A reusable recipe for new tasks, from ~/.berth/templates/*.json. {{name}}
// is the task's name; other {{var}}s become inputs in the New Task dialog.
export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  box?: string;
  location?: string;
  agent?: string;
  command?: string;
  prompt?: string;
  branch?: string;
  base?: string;
  variables?: TemplateVariable[];
}

export interface PluginHook {
  on: string;
  run: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  main: string;
  description?: string;
  // Ships inside the app (plugins/ in the repository) rather than
  // ~/.berth/plugins; a user plugin with the same id replaces it.
  builtin?: boolean;
  // false for a built-in that stays off until turned on in Settings.
  defaultEnabled?: boolean;
  // Where the app imports main from, relative to the agent's URL.
  entry?: string;
  // For a plugin in ~/.berth/plugins: on only once the user has allowed it.
  enabled?: boolean;
  // The hash of the manifest and main module the user allowed. The app
  // imports a plugin only when what it fetched hashes to this.
  allowed?: string;
  // Allowed once, but changed since: off until it is reviewed again.
  changed?: boolean;
  hooks?: PluginHook[];
  error?: string;
}

export interface ThemeColors {
  background: string;
  foreground: string;
  sidebar: string;
  sidebarForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  accent: string;
  accentForeground: string;
  primary: string;
  primaryForeground: string;
  card: string;
  popover: string;
  ring: string;
  success: string;
  warning: string;
  destructive: string;
}

export interface TerminalColors {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface Theme {
  id: string;
  name: string;
  appearance: "dark" | "light";
  colors: ThemeColors;
  terminal: TerminalColors;
}

// A hook from ~/.berth/hooks.json, or one a plugin adds (source
// "plugin:<id>", read-only).
export interface Hook {
  on: string;
  run: string;
  tool?: string;
  timeout?: string;
  source?: string;
}

export interface HooksFile {
  path: string;
  hooks: Hook[];
}

export interface WaitResult {
  state: AgentState | string;
  timed_out: boolean;
  // The turn the state belongs to, from boxes that keep turns.
  turn?: string;
}

export interface ExecResult {
  exit_code: number;
  // The end of the command's output, at most 64 KB.
  output: string;
  // True when the start of the output was dropped.
  truncated?: boolean;
}

// A service a repository declares for its worktrees (.berth/config.json),
// as it runs in one worktree.
export interface WorktreeService {
  name: string;
  run: string;
  autostart?: boolean;
  // "running", "stopped", "failed", …
  state: string;
  unit: string;
  port?: number;
}

// Runs: orchestrations the box executes and journals (loops, reviews,
// hand-offs, broadcasts, attempts, flows), from boxes whose info lists the
// "runs" capability. They keep going while the laptop sleeps and survive a
// restart of berthd.
export type RunStatus = "queued" | "running" | "waiting_gate" | "paused" | "succeeded" | "failed" | "cancelled" | "interrupted";

export interface RunUsage {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
  usd?: number;
}

// A gate a run waits at: someone approves or rejects it (a pick gate also
// names the winning attempt).
export interface RunGate {
  path: string;
  title: string;
  text?: string;
  deadline?: string;
  pick?: boolean;
  // The candidate a pick approves without naming one (0-based).
  default?: number;
}

export interface RunStep {
  id: string;
  kind: string;
  // Where it is in the run: "2" is the third step, "2.r1.0" the first step
  // of a loop's first round, "0.i3.1" the second step of a map's fourth item.
  path: string;
  status: "running" | "succeeded" | "failed" | "skipped" | "waiting" | "unknown" | "cancelled" | string;
  attempt?: number;
  started?: string;
  ended?: string;
  duration?: string;
  output?: string;
  exit_code: number;
  error?: string;
  turn?: string;
  session?: string;
  usage?: RunUsage;
  children?: RunStep[];
}

// One attempt of an attempts run.
export interface RunCandidate {
  index: number;
  agent?: string;
  location?: string;
  worktree?: string;
  path?: string;
  branch?: string;
  session?: string;
  verify: { passed: boolean; rounds?: number; exit_code: number; tail?: string };
  diff: { files: number; added: number; removed: number; commits: number };
  summary?: string;
  turns?: number;
  tokens?: RunUsage;
  judge: { rank?: number; reason?: string };
  picked?: boolean;
}

export interface RunSummary {
  id: string;
  template: string;
  title?: string;
  flow_id?: string;
  scope?: string;
  status: RunStatus;
  key?: string;
  // What deduplicates its trigger: github:<flow>:<pr>:<item>, webhook:...,
  // or the Idempotency-Key it was started with.
  idem_key?: string;
  group?: string;
  origin?: string;
  path?: string;
  session?: string;
  cursor?: string;
  test?: boolean;
  created: string;
  updated: string;
  finished?: string;
  error?: string;
  usage?: RunUsage;
  gate?: RunGate;
  steps?: number;
  candidates?: number;
}

export interface Run extends Omit<RunSummary, "steps" | "candidates"> {
  params?: Record<string, unknown>;
  vars?: Record<string, string>;
  steps: RunStep[];
  candidates?: RunCandidate[];
  budget?: { max_rounds?: number; max_agents?: number; max_wall?: string; max_usd?: number; max_tokens?: number };
}

export interface RunRequest {
  template?: string;
  params?: Record<string, unknown>;
  title?: string;
  // Ad-hoc steps instead of a template.
  flow?: unknown[];
  // Runs one of the box's flows now.
  flow_id?: string;
  scope?: string;
  data?: Record<string, unknown>;
  session?: string;
  path?: string;
  group?: string;
  budget?: Run["budget"];
}
