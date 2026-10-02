import { create } from "zustand";

import { toastManager } from "@/components/ui/toast";
import { errorMessage } from "@/lib/format";
import { Cancelled } from "@/lib/orchestrate-core";
import { send, wait } from "@/lib/orchestrate";
import { usePromptUi } from "@/lib/prompts";
import { meaningfulTail } from "@/lib/screen";
import { useStore } from "@/lib/store";

// A broadcast sends one prompt to many agents: one after another, so a box
// that fails or is slow never leaves the rest half sent, then (if asked)
// waits for every turn to end and keeps the last thing each agent said.

export type RowState = "queued" | "sending" | "sent" | "working" | "finished" | "waiting" | "timed-out" | "exited" | "failed" | "stopped";

export interface RunRow {
  box: string;
  session: string;
  text: string;
  state: RowState;
  error?: string;
  // The last lines on the agent's screen once its turn ended.
  tail?: string[];
}

export interface BroadcastRun {
  id: string;
  title: string;
  wait: boolean;
  rows: RunRow[];
  done: boolean;
}

interface RunState {
  run?: BroadcastRun;
  controller?: AbortController;
}

export const useBroadcastRun = create<RunState>()(() => ({}));

export const ENDED: RowState[] = ["finished", "waiting", "timed-out", "exited", "failed", "stopped"];

const patch = (id: string, i: number, p: Partial<RunRow>) =>
  useBroadcastRun.setState((s) => (s.run?.id === id ? { run: { ...s.run, rows: s.run.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) } } : s));

async function tailOf(box: string, session: string): Promise<string[] | undefined> {
  const c = useStore.getState().client;
  if (!c) return undefined;
  try {
    const { screen } = await c.box<{ screen: string }>(box, "GET", `sessions/${encodeURIComponent(session)}/screen`);
    return meaningfulTail(screen ?? "", 8);
  } catch {
    return undefined;
  }
}

export function summarize(rows: RunRow[]): string {
  const n = (s: RowState) => rows.filter((r) => r.state === s).length;
  const parts = [
    n("finished") && `${n("finished")} finished`,
    n("waiting") && `${n("waiting")} need${n("waiting") === 1 ? "s" : ""} you`,
    n("sent") && `${n("sent")} sent`,
    n("working") && `${n("working")} working`,
    n("timed-out") && `${n("timed-out")} still going`,
    n("exited") && `${n("exited")} exited`,
    n("failed") && `${n("failed")} failed`,
    n("stopped") && `${n("stopped")} not sent`,
  ];
  return parts.filter(Boolean).join(" · ");
}

// startBroadcast sends each item in turn. Waiting happens alongside: the
// next send does not wait for the previous agent's turn.
export function startBroadcast(o: { title: string; wait: boolean; timeout?: number; items: { box: string; session: string; text: string }[] }) {
  useBroadcastRun.getState().controller?.abort();
  const controller = new AbortController();
  const { signal } = controller;
  const id = Math.random().toString(36).slice(2);
  const rows: RunRow[] = o.items.map((it) => ({ ...it, state: "queued" }));
  useBroadcastRun.setState({ run: { id, title: o.title, wait: o.wait, rows, done: false }, controller });

  void (async () => {
    const waits: Promise<void>[] = [];
    for (const [i, it] of o.items.entries()) {
      if (signal.aborted) {
        patch(id, i, { state: "stopped" });
        continue;
      }
      patch(id, i, { state: "sending" });
      let at: string;
      try {
        at = await send(it.box, it.session, it.text);
      } catch (err) {
        patch(id, i, { state: "failed", error: errorMessage(err) });
        continue;
      }
      if (!o.wait) {
        patch(id, i, { state: "sent" });
        continue;
      }
      patch(id, i, { state: "working" });
      waits.push(
        wait(it.box, it.session, ["finished", "waiting"], { after: at, timeout: o.timeout ?? 1800, signal })
          .then(async (res) => {
            const state: RowState = res.timed_out ? "timed-out" : res.state === "exited" ? "exited" : res.state === "waiting" ? "waiting" : "finished";
            patch(id, i, { state, tail: await tailOf(it.box, it.session) });
          })
          .catch((err) => {
            // Stopping leaves a sent prompt sent; it only stops watching.
            if (err instanceof Cancelled || signal.aborted) patch(id, i, { state: "sent" });
            else patch(id, i, { state: "failed", error: errorMessage(err) });
          }),
      );
    }
    await Promise.all(waits);
    const s = useBroadcastRun.getState();
    if (s.run?.id !== id) return;
    useBroadcastRun.setState({ run: { ...s.run, done: true }, controller: undefined });
    // Out of sight, say how it went.
    if (!usePromptUi.getState().broadcast) {
      toastManager.add({
        title: `“${o.title}” ${o.wait ? "is done" : "was sent"}`,
        description: summarize(useBroadcastRun.getState().run?.rows ?? []),
        type: "success",
        actionProps: { children: "Results", onClick: () => usePromptUi.setState({ broadcast: {} }) },
      });
    }
  })();
}

export const stopBroadcast = () => useBroadcastRun.getState().controller?.abort();
export const clearBroadcast = () => {
  stopBroadcast();
  useBroadcastRun.setState({ run: undefined, controller: undefined });
};
