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

export interface Screen {
  id: string;
  title: string;
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

export interface BerthPluginContext {
  // The plugin's id from berth-plugin.json.
  readonly id: string;
  readonly api: BerthApi;
  readonly orchestrate: BerthOrchestrate;
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
// How the box API names a worktree's location: "cal" for the main checkout,
// "cal/billing" otherwise. For orchestrate.exec and box requests.
export declare function worktreeLocation(w: { location: string; worktree: string; main?: boolean }): string;
