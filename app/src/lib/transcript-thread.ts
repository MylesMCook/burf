import type { ThreadMessageLike } from "@assistant-ui/react";
import { foldPings, type PingItem } from "./agent-messages.ts";
import { rowKeyOf } from "./draft-text.ts";
import type { TranscriptItem } from "./transcript.ts";

// A session's transcript as the turns a thread draws (components/
// conversation/chat-thread.tsx). The record is a flat list of items; a
// person reads it as an exchange: something was said to the agent, the
// agent worked, and then it answered. So what the agent did on the way is
// folded into one line, and what it has to show stands below it.
//
// Kept here on their own so they can be tested and every chat groups a
// turn the same way.

type Of<K extends TranscriptItem["kind"]> = Extract<TranscriptItem, { kind: K }>;

export type TranscriptTurn =
  // The person: a prompt, or a command typed to the agent.
  | { kind: "said"; id: string; item: Of<"user"> | Of<"command"> }
  // Something that reached the agent from elsewhere and that it answers:
  // Burf's report, another agent's message, a ping from its own harness.
  | { kind: "arrived"; id: string; item: Of<"report"> | Of<"agent-message"> | Of<"ping"> }
  // A run of finished pings, as one line.
  | { kind: "pings"; id: string; items: PingItem[] }
  // The agent's turn: steps is the work it did on the way, folded; shown is
  // what it has to show for it, in order. working: this turn is still going.
  | { kind: "agent"; id: string; steps: TranscriptItem[]; shown: TranscriptItem[]; working: boolean };

const starts = (it: TranscriptItem): it is Of<"user"> | Of<"command"> | Of<"report"> | Of<"agent-message"> | Of<"ping"> =>
  it.kind === "user" || it.kind === "command" || it.kind === "report" || it.kind === "agent-message" || it.kind === "ping";

// Always in view, never folded with the steps: a change to a file, what the
// agent made, what it asks, where it is, and what the person should know.
const stands = (it: TranscriptItem) => it.kind === "edit" || it.kind === "artifact" || it.kind === "question" || it.kind === "ask" || it.kind === "thinking" || it.kind === "notice";

// agentTurn folds one turn. The answer is the turn's last words once it has
// finished, and its latest words while it works. When the agent says several
// things after its last step, the answer starts at the longest of them: a
// reply and a note after it both show; a "now I'll write it up" before the
// reply stays folded with the steps.
export function agentTurn(items: TranscriptItem[], working: boolean): Extract<TranscriptTurn, { kind: "agent" }> {
  let answer = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].kind !== "text") continue;
    answer = i;
    const words = (j: number) => {
      const it = items[j];
      return it.kind === "text" ? it.text.length : 0;
    };
    for (let j = i - 1; j >= 0 && (items[j].kind === "text" || items[j].kind === "edit"); j--) if (words(j) > words(answer)) answer = j;
    break;
  }
  const steps: TranscriptItem[] = [];
  const shown: TranscriptItem[] = [];
  items.forEach((it, i) => ((answer >= 0 && i >= answer && it.kind === "text") || stands(it) ? shown : steps).push(it));
  return { kind: "agent", id: rowKeyOf(items[0].id), steps, shown, working };
}

// A turn stays cached while its items and working state stay the same.
export interface TurnCache {
  agents: WeakMap<TranscriptItem, { items: TranscriptItem[]; turn: Extract<TranscriptTurn, { kind: "agent" }> }>;
  items: WeakMap<TranscriptItem, TranscriptTurn>;
  pings: WeakMap<PingItem, Extract<TranscriptTurn, { kind: "pings" }>>;
}

export const newTurnCache = (): TurnCache => ({ agents: new WeakMap(), items: new WeakMap(), pings: new WeakMap() });
const sameList = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// Group the transcript, caching by its first item. Only the last turn
// works, while the agent works or waits for permission or an answer.
export function transcriptTurns(items: readonly TranscriptItem[], cache: TurnCache = newTurnCache(), readOnly = false): TranscriptTurn[] {
  const last = items[items.length - 1];
  const live = !readOnly && !!last && (last.kind === "thinking" || (last.kind === "ask" && !last.decided) || (last.kind === "question" && !last.done));
  const out: TranscriptTurn[] = [];
  let run: TranscriptItem[] = [];
  const flush = (isLast: boolean) => {
    if (run.length) {
      const working = isLast && live;
      const was = cache.agents.get(run[0]);
      let turn = was?.turn;
      if (!was || !turn || turn.working !== working || !sameList(was.items, run)) {
        turn = agentTurn(run, working);
        if (was) {
          if (sameList(was.turn.steps, turn.steps)) turn.steps = was.turn.steps;
          if (sameList(was.turn.shown, turn.shown)) turn.shown = was.turn.shown;
        }
        cache.agents.set(run[0], { items: run, turn });
      }
      out.push(turn);
    }
    run = [];
  };
  for (const it of items) {
    if (!starts(it)) {
      run.push(it);
      continue;
    }
    flush(false);
    let turn = cache.items.get(it);
    if (!turn) cache.items.set(it, (turn = it.kind === "user" || it.kind === "command" ? { kind: "said", id: it.id, item: it } : { kind: "arrived", id: it.id, item: it }));
    out.push(turn);
  }
  flush(true);
  return foldPings<TranscriptTurn>(
    out,
    (t) => (t.kind === "arrived" && t.item.kind === "ping" ? t.item : undefined),
    (pings) => {
      const was = cache.pings.get(pings[0]);
      const turn = was && sameList(was.items, pings) ? was : { kind: "pings" as const, id: `pings-${pings[0].id}`, items: pings };
      cache.pings.set(pings[0], turn);
      return turn;
    },
  );
}

export const turnItems = (turn: TranscriptTurn): TranscriptItem[] => turn.kind === "agent" ? [...turn.steps, ...turn.shown] : turn.kind === "pings" ? turn.items : [turn.item];

// Between the parts of one row (the list's gap-4).
const PART_GAP = 16;

// A row starts with the old estimates for its fold and each visible item.
const estimates = new WeakMap<TranscriptTurn, number>();
export function estimateTurn(turn: TranscriptTurn): number {
  let height = estimates.get(turn);
  if (height === undefined) {
    if (turn.kind === "agent") {
      // Its fold and what it shows, with the gap the row keeps between them.
      const parts = (turn.steps.length ? 1 : 0) + turn.shown.length;
      height = (turn.steps.length ? 28 : 0) + turn.shown.reduce((sum, it) => sum + guessHeight(it), 0) + PART_GAP * Math.max(0, parts - 1);
    } else height = turn.kind === "pings" ? 22 : guessHeight(turn.item);
    estimates.set(turn, height);
  }
  return height;
}

function guessHeight(it: TranscriptItem): number {
  const lines = (t: string, per: number) => t.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / per)), 0);
  switch (it.kind) {
    case "user":
      return 22 * Math.min(lines(it.text, 60), 40) + 20;
    case "text":
      return 23 * Math.min(lines(it.text, 84), 400) + 8;
    case "ask":
      return 150;
    case "command":
      return 64;
    case "notice":
      return 84;
    case "artifact":
      return it.local ? (it.updated ? 40 : 112) : 54;
    case "question":
      return it.done ? 40 : 360;
    case "report":
      return it.report.answer || it.report.needs ? 78 : 40;
    case "agent-message":
      return it.msg.intent === "report" ? 104 : 40 + 22 * Math.min(lines(it.msg.body ?? "", 84), 12);
    case "ping":
      return 22;
    default:
      return 32;
  }
}

export interface TranscriptSearchEntry {
  row: number;
  item: string;
  text: string;
  open: string[];
}

// A match names its turn and item, and the folds that hide it.
export function transcriptSearchEntries(turns: readonly TranscriptTurn[], wordsOf: (it: TranscriptItem) => string): TranscriptSearchEntry[] {
  const out: TranscriptSearchEntry[] = [];
  turns.forEach((turn, row) => {
    const add = (it: TranscriptItem, open: string[]) => {
      const text = wordsOf(it);
      if (text) out.push({ row, item: it.id, text, open: it.kind === "tools" ? [...open, it.id] : open });
    };
    if (turn.kind === "agent") {
      for (const it of turn.steps) add(it, [`fold-${turn.steps[0].id}`]);
      for (const it of turn.shown) add(it, []);
    } else if (turn.kind === "pings") for (const it of turn.items) add(it, []);
    else add(turn.item, []);
  });
  return out;
}

// Converted messages and their parts keep identity while their data does.
const done = { type: "complete", reason: "stop" } as const;
const messages = new WeakMap<TranscriptTurn, ThreadMessageLike>();
type ItemPart = { type: "data-item"; data: TranscriptItem };
const parts = new WeakMap<TranscriptItem, ItemPart>();
function itemPart(it: TranscriptItem): ItemPart {
  let part = parts.get(it);
  if (!part) parts.set(it, (part = { type: "data-item", data: it }));
  return part;
}
type StepsPart = { type: "data-steps"; data: { id: string; steps: TranscriptItem[]; working: boolean } };
const stepsParts = new WeakMap<TranscriptItem[], StepsPart>();
function stepsPart(turn: Extract<TranscriptTurn, { kind: "agent" }>): StepsPart {
  let part = stepsParts.get(turn.steps);
  if (!part || part.data.working !== turn.working) stepsParts.set(turn.steps, (part = { type: "data-steps", data: { id: `fold-${turn.steps[0].id}`, steps: turn.steps, working: turn.working } }));
  return part;
}

export function transcriptMessage(turn: TranscriptTurn): ThreadMessageLike {
  const was = messages.get(turn);
  if (was) return was;
  let out: ThreadMessageLike;
  switch (turn.kind) {
    case "said":
      out = { id: turn.id, role: turn.item.kind === "user" ? "user" : "assistant", content: [itemPart(turn.item)], ...(turn.item.kind === "user" ? {} : { status: done, metadata: { custom: { own: true } } }) };
      break;
    case "arrived":
      out = { id: turn.id, role: "assistant", status: done, content: [itemPart(turn.item)], metadata: { custom: { own: true } } };
      break;
    case "pings":
      out = { id: turn.id, role: "assistant", status: done, content: [{ type: "data-pings", data: turn.items }], metadata: { custom: { own: true } } };
      break;
    case "agent":
      out = { id: turn.id, role: "assistant", status: turn.working ? { type: "running" } : done, content: [...(turn.steps.length ? [stepsPart(turn)] : []), ...turn.shown.map(itemPart)] };
      break;
  }
  messages.set(turn, out);
  return out;
}
