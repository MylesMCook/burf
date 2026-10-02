import type { AgentPreset, ExecResult, Session, TaskResult, WaitResult } from "@berth/plugin";

// The orchestration logic, free of the app's store so plugins, tests and the
// app share it. It mirrors `berth loop` and friends (internal/boxcmd): the
// same calls, the same order, the same messages.

// BoxCaller is the one thing it needs: a box API call through the agent.
export type BoxCaller = <T = unknown>(box: string, method: string, path: string, body?: unknown) => Promise<T>;

const enc = encodeURIComponent;

export class Cancelled extends Error {
  constructor() {
    super("cancelled");
  }
}

// abortable settles with p, or rejects with Cancelled as soon as signal
// aborts. The request itself runs on; a wait simply ends on the box later.
function abortable<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new Cancelled());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Cancelled());
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

// shellQuote and agentCommand build a command line exactly as the box's
// AgentCommand does, so starting an agent here or there is the same.
export const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

export function agentCommand(p: Pick<AgentPreset, "command" | "prompt_flag">, prompt: string): string {
  if (!prompt) return p.command;
  return p.prompt_flag ? `${p.command} ${p.prompt_flag} ${shellQuote(prompt)}` : `${p.command} ${shellQuote(prompt)}`;
}

// send types text into a session as one paste, then Enter. It returns the
// box's clock at that moment, which is what a following wait should count
// from: the laptop's clock may not match the box's.
export async function send(call: BoxCaller, box: string, session: string, text: string, enter = true): Promise<string> {
  const before = new Date().toISOString();
  const res = await call<{ at?: string } | undefined>(box, "POST", `sessions/${enc(session)}/send`, { text, enter });
  return res?.at ?? before;
}

export interface WaitOptions {
  // Only states reported after this time count (RFC 3339). Default: now.
  after?: string;
  // Seconds before giving up. Default: 30 minutes, like `berth session wait`.
  timeout?: number;
  signal?: AbortSignal;
}

// One long poll is at most this long, as in the CLI's waitFor: a single
// request could otherwise outlive a network change between laptop and box.
const WAIT_STEP_SECONDS = 300;

// wait returns once the session's agent reports one of states after
// `after`, its program exits ("exited"), or the timeout passes (timed_out).
export async function wait(call: BoxCaller, box: string, session: string, states: string[], o: WaitOptions = {}): Promise<WaitResult> {
  const after = o.after ?? new Date().toISOString();
  const deadline = Date.now() + (o.timeout ?? 1800) * 1000;
  for (;;) {
    const step = Math.max(1, Math.min(WAIT_STEP_SECONDS, Math.ceil((deadline - Date.now()) / 1000)));
    const q = new URLSearchParams({ for: states.join(","), timeout: `${step}s`, after });
    const res = await abortable(call<WaitResult>(box, "GET", `sessions/${enc(session)}/wait?${q}`), o.signal);
    if (!res.timed_out || Date.now() >= deadline) return res;
  }
}

export function exec(call: BoxCaller, box: string, location: string, command: string, timeout = "10m", signal?: AbortSignal): Promise<ExecResult & { truncated?: boolean }> {
  return abortable(call(box, "POST", "exec", { location, command, timeout }), signal);
}

export interface HandoffRequest {
  box: string;
  // The session handing the work off, and where it runs ("loc" or "loc/wt").
  fromSession: string;
  location: string;
  agent: Pick<AgentPreset, "id" | "command" | "prompt_flag">;
  prompt: string;
  // A new worktree for the next agent; without it, it works beside the
  // first one, in the same worktree.
  worktree?: { name: string; branch?: string; base?: string };
}

// handoff starts another agent on the work, with the prompt as its first
// message. A new worktree goes through POST tasks, which records the handoff
// and lets the box resolve the agent (repository presets included).
export async function handoff(call: BoxCaller, r: HandoffRequest): Promise<Session> {
  if (r.worktree) {
    const task = await call<TaskResult>(r.box, "POST", "tasks", {
      location: r.location.split("/")[0],
      ...r.worktree,
      agent: r.agent.id,
      prompt: r.prompt,
      from_session: r.fromSession,
    });
    return task.session;
  }
  return call<Session>(r.box, "POST", "sessions", { location: r.location, command: agentCommand(r.agent, r.prompt) });
}

// handoffPrompt is how a hand-off starts. Beside the first agent it is the
// same folder; in a new worktree it names where the work was, so the next
// agent can read it.
export const handoffPrompt = (from: { worktree: string; path: string }, sameWorktree: boolean) =>
  sameWorktree
    ? "Continue the work in this worktree. Read the git diff and the last messages first."
    : `Continue the work from ${from.worktree} (${from.path}). Read its git diff first, then carry on here.`;

export const reviewPrompt = (from: string) =>
  `Review the changes ${from} made in this worktree (git diff against the base branch, and any uncommitted work). List real problems, most important first, with file and line. Do not change any files.`;

// review starts a second agent in the same worktree that reads the first
// one's changes and reports problems.
export function review(call: BoxCaller, r: Omit<HandoffRequest, "worktree" | "prompt"> & { prompt?: string }): Promise<Session> {
  return handoff(call, { ...r, prompt: r.prompt ?? reviewPrompt(r.fromSession) });
}

// The feedback a failed check sends back: the end of its output, as the CLI
// does (`berth loop`).
export function checkFailedPrompt(check: string, exitCode: number, output: string): string {
  const tail = output.length > 4000 ? `…${output.slice(-4000)}` : output;
  return `The check \`${check}\` failed (exit ${exitCode}):\n\n${tail.trim()}\n\nFix it.`;
}

export type LoopPhase = "prompting" | "waiting" | "checking";
export type LoopOutcome = "passed" | "failed" | "needs-you" | "exited" | "timed-out" | "cancelled" | "error";

export interface LoopProgress {
  round: number;
  phase: LoopPhase;
  // What the CLI would print at this point.
  message: string;
}

export interface LoopResult {
  outcome: LoopOutcome;
  rounds: number;
  message: string;
  // The last check's exit code and the end of its output.
  exitCode?: number;
  output?: string;
}

export interface LoopRequest {
  box: string;
  session: string;
  // Where the check runs: the session's location ("loc" or "loc/wt").
  location: string;
  // The first prompt. Empty runs the check first.
  prompt: string;
  check: string;
  max?: number;
  // Seconds an agent's turn may take; the CLI's --turn-timeout.
  turnTimeout?: number;
  signal?: AbortSignal;
  onProgress?(p: LoopProgress): void;
  onCheck?(r: { round: number; exitCode: number; output: string }): void;
}

// loop prompts the agent, waits for its turn to end, runs the check, and
// sends the failure back until the check passes or the rounds run out. It
// stops when the agent waits for a human: answering is theirs to do.
export async function loop(call: BoxCaller, r: LoopRequest): Promise<LoopResult> {
  const max = r.max ?? 5;
  const turn = r.turnTimeout ?? 1800;
  let text = r.prompt;
  let last: { exitCode: number; output: string } | undefined;
  let round = 1;
  const done = (outcome: LoopOutcome, message: string): LoopResult => ({ outcome, rounds: round, message, exitCode: last?.exitCode, output: last?.output });
  try {
    for (; round <= max; round++) {
      if (text) {
        r.onProgress?.({ round, phase: "prompting", message: `Round ${round}: prompting ${r.session}…` });
        const after = await abortable(send(call, r.box, r.session, text), r.signal);
        r.onProgress?.({ round, phase: "waiting", message: `Round ${round}: prompted ${r.session}, waiting for its turn to end…` });
        const res = await wait(call, r.box, r.session, ["finished", "waiting"], { after, timeout: turn, signal: r.signal });
        if (res.timed_out) return done("timed-out", `${r.session} was still ${res.state || "working"} after ${formatSeconds(turn)}`);
        if (res.state === "waiting") return done("needs-you", `${r.session} is waiting for you; answer it, then run the loop again`);
        if (res.state === "exited") return done("exited", `${r.session} has exited`);
      }
      r.onProgress?.({ round, phase: "checking", message: `Round ${round}: checking with ${JSON.stringify(r.check)}…` });
      const res = await exec(call, r.box, r.location, r.check, "30m", r.signal);
      last = { exitCode: res.exit_code, output: res.output };
      r.onCheck?.({ round, ...last });
      if (res.exit_code === 0) return done("passed", `Passed after ${round} round(s).`);
      text = checkFailedPrompt(r.check, res.exit_code, res.output);
    }
    round = max;
    return done("failed", `the check still fails after ${max} rounds`);
  } catch (err) {
    if (err instanceof Cancelled) return done("cancelled", "Cancelled.");
    return done("error", err instanceof Error ? err.message : String(err));
  }
}

function formatSeconds(s: number): string {
  if (s % 3600 === 0) return `${s / 3600}h0m0s`;
  if (s % 60 === 0) return `${s / 60}m0s`;
  return `${s}s`;
}
