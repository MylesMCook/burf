import type { AgentPreset, ExecResult, SendResult, Session, TaskResult, TurnWait, WaitResult } from "@berth/plugin";

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

export interface SendOptions {
  enter?: boolean;
  // "now" types at once; "idle" holds it on the box until the agent is
  // idle. Either way the box refuses to type into an agent waiting for
  // someone unless force: an Enter there would answer for the person.
  when?: "now" | "idle";
  force?: boolean;
  // A retry with the same key returns the turn it already made.
  idemKey?: string;
}

// send types text into a session as one paste, then Enter. It returns the
// turn it started (boxes with the "turns" capability) and the box's clock at
// that moment (`at`), which an older box's wait counts from: the laptop's
// clock may not match the box's.
export async function send(call: BoxCaller, box: string, session: string, text: string, opts: boolean | SendOptions = {}): Promise<SendResult> {
  const o: SendOptions = typeof opts === "boolean" ? { enter: opts } : opts;
  const before = new Date().toISOString();
  const body: Record<string, unknown> = { text, enter: o.enter ?? true, when: o.when ?? "now" };
  if (o.force) body.force = true;
  if (o.idemKey) body.idem_key = o.idemKey;
  const res = await call<Partial<SendResult> | undefined>(box, "POST", `sessions/${enc(session)}/send`, body);
  return { sent: res?.sent ?? true, ...res, at: res?.at ?? before };
}

// isWaitingRefusal says whether a send was refused because the agent waits
// for someone (HTTP 409).
export const isWaitingRefusal = (err: unknown): boolean => (err as { status?: number } | null)?.status === 409;

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

// waitTurn returns once the turn ends (finished, exited or lost) or, with
// until "waiting", also when it waits for someone; or the timeout passes.
export async function waitTurn(
  call: BoxCaller,
  box: string,
  turn: string,
  o: { until?: "end" | "waiting"; timeout?: number; signal?: AbortSignal } = {},
): Promise<TurnWait> {
  const deadline = Date.now() + (o.timeout ?? 1800) * 1000;
  for (;;) {
    const step = Math.max(1, Math.min(WAIT_STEP_SECONDS, Math.ceil((deadline - Date.now()) / 1000)));
    const q = new URLSearchParams({ until: o.until ?? "end", timeout: `${step}s` });
    const res = await abortable(call<TurnWait>(box, "GET", `turns/${enc(turn)}/wait?${q}`), o.signal);
    if (!res.timed_out || Date.now() >= deadline) return res;
  }
}

// waitSent waits for the turn a send started: by its ID on a box that keeps
// turns, else (an older box) from the box's own time of the send.
export async function waitSent(call: BoxCaller, box: string, session: string, sent: SendResult, o: Omit<WaitOptions, "after"> = {}): Promise<WaitResult> {
  if (sent.turn) {
    const w = await waitTurn(call, box, sent.turn, { until: "waiting", timeout: o.timeout, signal: o.signal });
    return { state: w.state, timed_out: w.timed_out, turn: w.turn?.id ?? sent.turn };
  }
  return wait(call, box, session, ["finished", "waiting"], { ...o, after: sent.at });
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

// checkFeedback trims a check's output to what an agent needs, at most limit
// characters: the lines that say what failed, then the end. Colours and runs
// of blank lines go. Every character goes into the agent's context on each
// round, so it is never the whole log. It mirrors box.CheckFeedback.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g;
const FAILING = /(\bfail(ed|ure|ing)?\b|\berror\b|panic|\bexpected\b|assert|✗|✘|×|\bnot ok\b|undefined|cannot find|exception|traceback|\bTS\d{4}\b)/i;

export function checkFeedback(output: string, limit = 3000): string {
  const lines: string[] = [];
  let blank = false;
  for (const raw of output.replace(ANSI, "").replaceAll("\r\n", "\n").split("\n")) {
    const l = raw.trimEnd();
    if (!l) {
      if (blank) continue;
      blank = true;
    } else blank = false;
    lines.push(l);
  }
  const joined = lines.join("\n").trim();
  if (joined.length <= limit) return joined;
  const clip = (l: string) => (l.length > 240 ? `${l.slice(0, 240)}…` : l);
  const tail: string[] = [];
  let used = 0;
  let tailFrom = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = clip(lines[i]);
    if (used + l.length + 1 > limit / 2) break;
    tail.unshift(l);
    used += l.length + 1;
    tailFrom = i;
  }
  const head: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < tailFrom; i++) {
    const l = clip(lines[i].trim());
    if (!l || seen.has(l) || !FAILING.test(l)) continue;
    if (used + l.length + 1 > limit - 8) break;
    seen.add(l);
    head.push(l);
    used += l.length + 1;
  }
  return [...head, "…", ...tail].join("\n");
}

// The feedback a failed check sends back: what failed, as `berth loop` does.
export function checkFailedPrompt(check: string, exitCode: number, output: string): string {
  return `\`${check}\` failed (exit ${exitCode}):\n\`\`\`\n${checkFeedback(output)}\n\`\`\`\nFix it.`;
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
  // One key per round: a retried send never types the prompt twice.
  const run = `loop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const needsYou = `${r.session} is waiting for you; answer it, then run the loop again`;
  const done = (outcome: LoopOutcome, message: string): LoopResult => ({ outcome, rounds: round, message, exitCode: last?.exitCode, output: last?.output });
  try {
    for (; round <= max; round++) {
      if (text) {
        r.onProgress?.({ round, phase: "prompting", message: `Round ${round}: prompting ${r.session}…` });
        let sent: SendResult;
        try {
          sent = await abortable(send(call, r.box, r.session, text, { when: "now", idemKey: `${run}-${round}` }), r.signal);
        } catch (err) {
          // The box will not type into an agent at a question.
          if (isWaitingRefusal(err)) return done("needs-you", needsYou);
          throw err;
        }
        r.onProgress?.({ round, phase: "waiting", message: `Round ${round}: prompted ${r.session}, waiting for its turn to end…` });
        const res = await waitSent(call, r.box, r.session, sent, { timeout: turn, signal: r.signal });
        if (res.timed_out) return done("timed-out", `${r.session} was still ${res.state || "working"} after ${formatSeconds(turn)}`);
        if (res.state === "waiting") return done("needs-you", needsYou);
        if (res.state === "exited" || res.state === "lost") return done("exited", `${r.session} has ${res.state}`);
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
