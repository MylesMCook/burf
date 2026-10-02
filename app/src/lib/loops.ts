import { create } from "zustand";

import { type BoxCaller, type LoopOutcome, type LoopPhase, type LoopProgress, type LoopResult, loop as runLoop } from "@/lib/orchestrate-core";

// Loops run in the app, not in a view: they keep going while you move
// between worktrees, and this store is what the loops panel shows.

export interface Loop {
  id: string;
  box: string;
  session: string;
  check: string;
  round: number;
  max: number;
  phase: LoopPhase;
  // Set once the loop has ended.
  outcome?: LoopOutcome;
  message: string;
  // The last check's exit code and the end of its output.
  exitCode?: number;
  output?: string;
  started: number;
  ended?: number;
  cancel(): void;
}

export const isLive = (l: Loop) => !l.outcome;

export const useLoops = create<{ loops: Loop[] }>()(() => ({ loops: [] }));

const update = (id: string, patch: Partial<Loop>) =>
  useLoops.setState((s) => ({ loops: s.loops.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

export function dismissLoop(id: string) {
  useLoops.setState((s) => ({ loops: s.loops.filter((l) => l.id !== id) }));
}

const OUTPUT_TAIL = 4000;

export interface StartLoop {
  box: string;
  session: string;
  location: string;
  prompt: string;
  check: string;
  max: number;
  signal?: AbortSignal;
  onProgress?(p: LoopProgress): void;
}

let next = 0;

// startLoop runs a loop in the background and tracks it; the promise settles
// with its result, for callers (plugins) that want to await it.
export function startLoop(call: BoxCaller, o: StartLoop): { id: string; done: Promise<LoopResult> } {
  const abort = new AbortController();
  o.signal?.addEventListener("abort", () => abort.abort(), { once: true });
  const id = `loop-${Date.now().toString(36)}-${next++}`;
  useLoops.setState((s) => ({
    loops: [
      ...s.loops,
      { id, box: o.box, session: o.session, check: o.check, round: 1, max: o.max, phase: o.prompt ? "prompting" : "checking", message: "Starting…", started: Date.now(), cancel: () => abort.abort() },
    ],
  }));
  const done = runLoop(call, {
    ...o,
    signal: abort.signal,
    onProgress: (p) => {
      update(id, { round: p.round, phase: p.phase, message: p.message });
      o.onProgress?.(p);
    },
    onCheck: (c) => update(id, { exitCode: c.exitCode, output: c.output.length > OUTPUT_TAIL ? `…${c.output.slice(-OUTPUT_TAIL)}` : c.output }),
  }).then((res) => {
    update(id, { outcome: res.outcome, message: res.message, round: res.rounds, ended: Date.now() });
    return res;
  });
  return { id, done };
}
