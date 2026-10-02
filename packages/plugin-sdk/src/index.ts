import type { ComponentType } from "react";

import type {
  BerthEvent,
  BoxInfo,
  BoxStatus,
  ExecResult,
  Location,
  Service,
  Session,
  Stats,
  Status,
  TaskRequest,
  TaskResult,
  Theme,
  WaitResult,
} from "./types";

export type * from "./types";

// Every add* returns a function that removes what it added. Anything a plugin
// registers is also removed when the plugin is unloaded, so returning these
// from activate is optional.
export type Dispose = () => void;

// A lucide icon name, such as "Sparkles" or "PanelsTopLeft".
export type IconName = string;

export interface ScreenProps {
  berth: BerthPluginContext;
}

// A screen opens in the main area under the app's header strip, which shows
// title (and description) until the screen renders its own ViewHeader from
// @berth/plugin/ui to add actions or a live description. By default the app
// lays the screen out as a page, one width and left aligned like the app's
// own; "fill" hands it the whole area below the strip instead, for tables
// and split views that scroll themselves.
export interface Screen {
  id: string;
  title: string;
  description?: string;
  layout?: "page" | "fill";
  Component: ComponentType<ScreenProps>;
}

// A sidebar row under the app's own entries that opens one of the plugin's
// screens.
export interface SidebarItem {
  id: string;
  title: string;
  icon?: IconName;
  screen: string;
}

export interface WorktreePanelProps extends ScreenProps {
  box: string;
  location: string;
  worktree: string;
  path: string;
  // True for the repository's own checkout.
  main?: boolean;
}

// The worktree whose workspace is in front.
export interface CurrentWorktree {
  box: string;
  location: string;
  worktree: string;
  path: string;
  main?: boolean;
}

// Small values a plugin keeps on this computer between launches, kept apart
// from other plugins'. JSON-serialisable values only.
export interface PluginStorage {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
}

// A view about one worktree. It opens as a tab, or a split, in that
// worktree's workspace, from the "+" menu or with openPanel.
export interface WorktreePanel {
  id: string;
  title: string;
  // A lucide icon name for the "+" menu and the tab.
  icon?: IconName;
  Component: ComponentType<WorktreePanelProps>;
}

// An entry in the command palette (⌘K).
export interface Command {
  id: string;
  title: string;
  group?: string;
  shortcut?: string;
  run: () => void | Promise<void>;
}

export interface StatusBarItem {
  id: string;
  Component: ComponentType<ScreenProps>;
  align?: "left" | "right";
}

export type EventHandler = (event: BerthEvent) => void;

// A typed client for the laptop agent, the same one the app uses.
export interface BerthApi {
  status(): Promise<Status>;
  // Boxes paired with this laptop and whether they are online.
  boxes(): Promise<BoxStatus[]>;
  locations(box: string): Promise<Location[]>;
  sessions(box: string): Promise<Session[]>;
  stats(box: string): Promise<Stats>;
  services(box: string): Promise<Service[]>;
  info(box: string): Promise<BoxInfo>;
  // Any box API call: request("devl", "GET", "ports").
  request<T = unknown>(box: string, method: string, path: string, body?: unknown): Promise<T>;
  createTask(box: string, task: TaskRequest): Promise<TaskResult>;
  // The private URL of a port on a box, served by the laptop's proxy.
  serviceUrl(box: string, port: number): string;
}

// What a loop reports while it runs, and how it ends; see orchestrate.loop.
export interface LoopProgress {
  round: number;
  phase: "prompting" | "waiting" | "checking";
  // What `berth loop` prints at this point.
  message: string;
}

export interface LoopResult {
  outcome: "passed" | "failed" | "needs-you" | "exited" | "timed-out" | "cancelled" | "error";
  rounds: number;
  message: string;
  // The last check's exit code and output.
  exitCode?: number;
  output?: string;
}

// Agents driving agents, the same as `berth session send|wait`, `berth exec`
// and `berth loop` (docs/orchestration.md). Sessions are named by box and
// session name; locations as the box API names them, "loc" or "loc/wt".
export interface BerthOrchestrate {
  // Types text into a session as one paste, then Enter. Resolves with the
  // box's time at that moment: pass it as `after` to a following wait.
  send(box: string, session: string, text: string, enter?: boolean): Promise<string>;
  // Resolves once the session's agent reports one of states ("finished",
  // "waiting", "idle", "running") after `after` (default: now), its program
  // exits (state "exited"), or `timeout` seconds pass (timed_out).
  wait(box: string, session: string, states: string[], opts?: { after?: string; timeout?: number; signal?: AbortSignal }): Promise<WaitResult>;
  // Runs a command to completion in a location or worktree.
  exec(box: string, location: string, command: string, timeout?: string): Promise<ExecResult>;
  // Starts another agent (a preset id such as "codex") on a session's work
  // with prompt as its first message: in a new worktree when given one,
  // otherwise beside it in the same worktree. Resolves with the new session.
  handoff(opts: { box: string; from: string; agent: string; prompt: string; worktree?: { name: string; branch?: string; base?: string } }): Promise<Session>;
  // A second agent in the same worktree that reviews the first one's changes.
  review(opts: { box: string; from: string; agent: string; prompt?: string }): Promise<Session>;
  // Prompt, wait for the turn to end, run check, and send failures back
  // until it passes, max rounds run out, or the agent needs a human. It shows
  // in the app's loops panel; done settles with how it ended.
  loop(opts: { box: string; session: string; prompt: string; check: string; max?: number; signal?: AbortSignal; onProgress?(p: LoopProgress): void }): { id: string; done: Promise<LoopResult> };
}

// Saved prompts: the library the app's prompt picker and broadcast use, one
// document on this laptop (/v1/app/prompts). Bodies take {{variables}}: the
// built-ins ({{branch}}, {{worktree.name}}, {{box}}, {{project}}…) fill in
// from the session a prompt goes to; the rest people fill in when sending.
export interface SavedPromptVariable {
  name: string;
  label?: string;
  default?: string;
  multiline?: boolean;
}

export interface SavedPrompt {
  id: string;
  title: string;
  body: string;
  tags: string[];
  // A project's id (as the sidebar groups them) to offer it only there.
  project?: string;
  variables?: SavedPromptVariable[];
  updated?: string;
  uses?: number;
  last_used?: string;
}

export interface PromptSegment {
  text: string;
  variable?: string;
  missing?: boolean;
}

export interface PromptTarget {
  box: string;
  session: string;
}

export interface BerthPrompts {
  // The library now. Until the laptop holds one, the starter prompts.
  list(): SavedPrompt[];
  // Re-reads the library from the laptop.
  load(): Promise<SavedPrompt[]>;
  save(prompts: SavedPrompt[]): Promise<void>;
  // Calls listener whenever the library changes; returns how to stop.
  subscribe(listener: () => void): Dispose;
  readonly starters: SavedPrompt[];
  readonly builtins: { name: string; label: string }[];
  // The variables people fill in for a prompt (not the built-ins).
  variables(prompt: Pick<SavedPrompt, "body" | "variables">): SavedPromptVariable[];
  // A body with its variables filled, built-ins from target when given.
  fill(body: string, values: Record<string, string | undefined>, target?: PromptTarget): string;
  // The same as pieces, marking what each variable filled or that it is missing.
  segments(body: string, values: Record<string, string | undefined>, target?: PromptTarget): PromptSegment[];
  newId(): string;
  // The app's picker: choose a prompt, fill it in, send it to a session
  // (the focused one, or one the person chooses).
  openPicker(opts?: { box?: string; session?: string; promptId?: string }): void;
  // The app's broadcast: one prompt to several agents, with results.
  openBroadcast(opts?: { promptId?: string; text?: string; targets?: PromptTarget[] }): void;
}

export interface BerthPluginContext {
  // The plugin's id from berth-plugin.json.
  readonly id: string;
  readonly api: BerthApi;
  readonly orchestrate: BerthOrchestrate;
  readonly prompts: BerthPrompts;
  addSidebarItem(item: SidebarItem): Dispose;
  addScreen(screen: Screen): Dispose;
  addWorktreePanel(panel: WorktreePanel): Dispose;
  addCommand(command: Command): Dispose;
  addStatusBarItem(item: StatusBarItem): Dispose;
  addTheme(theme: Theme): Dispose;
  // Calls handler for events of a type ("agent.waiting"), a prefix
  // ("worktree.*"), or every event ("*").
  on(type: string, handler: EventHandler): Dispose;
  // A toast in the app, and a system notification when it is not focused.
  notify(title: string, body?: string): void;
  openScreen(id: string): void;
  openTerminal(box: string, session: string): void;
  openUrl(url: string): void;
  // Brings a worktree's workspace to the front, as clicking it in the
  // sidebar does.
  openWorktree(worktree: CurrentWorktree): void;
  // Opens a page in a browser tab of the current worktree, or beside the
  // focused pane with split.
  openBrowser(url: string, opts?: { split?: "row" | "col" }): void;
  // Opens one of this plugin's worktree panels in the current worktree.
  openPanel(panel: string, opts?: { split?: "row" | "col" }): void;
  readonly storage: PluginStorage;
}

export type Activate = (berth: BerthPluginContext) => void | Dispose | Promise<void | Dispose>;

// definePlugin is an identity function that gives activate its types.
export declare function definePlugin(activate: Activate): Activate;

// Hooks for plugin components, backed by the app's live state.
export declare function useBerth(): BerthPluginContext;
export declare function useBoxes(): BoxStatus[];
export declare function useLocations(box: string): Location[] | undefined;
export declare function useSessions(box: string): Session[] | undefined;
export declare function useStats(box: string): Stats | undefined;
export declare function useEvent(type: string, handler: EventHandler): void;
// The worktree whose workspace is in front, if any.
export declare function useCurrentWorktree(): CurrentWorktree | undefined;
// Like useState, kept in the plugin's storage.
export declare function useStorage<T>(key: string, initial: T): [T, (value: T) => void];

// A project is one repository wherever it is checked out, as the app's
// sidebar shows it: "calcom/cal.com" on devl and on gpu is one project with
// two members. defaultBox is where new work goes unless the person picks
// another (the project's "Default box" in the app).
export interface ProjectMember {
  box: string;
  online: boolean;
  // The repository's main checkout on that box, with its worktrees.
  location: Location;
}

export interface Project {
  id: string;
  name: string;
  // owner/name on its forge, when it has one.
  slug?: string;
  remote?: string;
  defaultBox: string;
  members: ProjectMember[];
}

// Every project across every box, live, sorted by name.
export declare function useProjects(): Project[];
// How the box API names a worktree's location: "cal" for the main checkout,
// "cal/billing" otherwise. For orchestrate.exec and box requests.
export declare function worktreeLocation(w: { location: string; worktree: string; main?: boolean }): string;
// What the app calls a session, so a plugin names it the same way: the
// agent's name or "Shell", numbered when its worktree has several ("Claude
// Code 2"); with place, where it runs too ("cal / billing-fix · Codex").
// Pass the box's sessions for the number and its locations for the place.
export declare function sessionName(session: Session, opts?: { sessions?: Session[]; locations?: Location[]; place?: boolean }): string;
