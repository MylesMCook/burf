import type { Session } from "@/lib/api";
import { agentPresets, worktreeRef } from "@/lib/actions";
import { startLoop } from "@/lib/loops";
import * as core from "@/lib/orchestrate-core";
import { scheduleRefresh, useStore } from "@/lib/store";

export { handoffPrompt, reviewPrompt } from "@/lib/orchestrate-core";

// Orchestration for the app and its plugins: the logic in orchestrate-core,
// bound to the app's connection, with sessions and agents looked up in the
// app's state. See docs/orchestration.md.

const call: core.BoxCaller = (box, method, path, body) => {
  const c = useStore.getState().client;
  if (!c) return Promise.reject(new Error("not connected to the Berth agent"));
  return c.box(box, method, path, body);
};

// sessionLocation is where a session runs, as the box API names it: "loc"
// or "loc/wt".
export function sessionLocation(box: string, session: string): string {
  const data = useStore.getState().boxes[box];
  const s = data?.sessions?.find((x) => x.name === session);
  if (s?.location) return s.location;
  for (const loc of data?.locations ?? []) {
    for (const wt of loc.worktrees ?? []) if (wt.path === s?.dir) return worktreeRef(loc, wt);
  }
  throw new Error(`cannot tell which worktree ${session} is in`);
}

export const send = (box: string, session: string, text: string, enter = true) => core.send(call, box, session, text, enter);

export const wait = (box: string, session: string, states: string[], o?: core.WaitOptions) => core.wait(call, box, session, states, o);

export const exec = (box: string, location: string, command: string, timeout?: string, signal?: AbortSignal) => core.exec(call, box, location, command, timeout, signal);

export interface HandoffOptions {
  box: string;
  // The session handing off.
  from: string;
  // An agent preset id, from the box's or the repository's agents.
  agent: string;
  prompt: string;
  // A new worktree for the next agent; without it, the same worktree.
  worktree?: { name: string; branch?: string; base?: string };
  // Called as soon as the new session exists.
  onStarted?(s: Session): void;
}

function preset(box: string, location: string, id: string) {
  const p = agentPresets(box, location.split("/")[0]).find((x) => x.id === id);
  if (!p) throw new Error(`${box} has no agent ${id}`);
  return p;
}

// handoff starts another agent on the work and returns its session.
export async function handoff(o: HandoffOptions): Promise<Session> {
  const location = sessionLocation(o.box, o.from);
  const agent = o.worktree ? { id: o.agent, command: "" } : preset(o.box, location, o.agent);
  const s = await core.handoff(call, { box: o.box, fromSession: o.from, location, agent, prompt: o.prompt, worktree: o.worktree });
  o.onStarted?.(s);
  scheduleRefresh(o.box, o.worktree ? ["locations", "sessions"] : ["sessions"]);
  return s;
}

// review starts a second agent beside a session to read its changes.
export function review(o: Omit<HandoffOptions, "worktree" | "prompt"> & { prompt?: string }): Promise<Session> {
  return handoff({ ...o, prompt: o.prompt ?? core.reviewPrompt(o.from) });
}

export interface LoopOptions {
  box: string;
  session: string;
  prompt: string;
  check: string;
  max?: number;
  signal?: AbortSignal;
  onProgress?(p: core.LoopProgress): void;
}

// loop starts `berth loop` in the app; the loops panel shows its progress.
export function loop(o: LoopOptions) {
  return startLoop(call, { ...o, max: Math.max(1, o.max ?? 5), location: sessionLocation(o.box, o.session) });
}
