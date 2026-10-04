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
}

export interface BoxInfo {
  name?: string;
  version?: string;
  os?: string;
  arch?: string;
  build?: string;
  tools?: string[];
  agents?: AgentPreset[];
}

export interface Check {
  area: string;
  name: string;
  status: "ok" | "warn" | "fail" | "info" | string;
  detail?: string;
  fix?: string;
}

export interface BerthEvent {
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
