import { foldPings, type PingItem } from "./agent-messages.ts";
import type { TranscriptItem } from "./transcript.ts";

// A session's transcript as the turns a thread draws (components/
// conversation/chat-thread.tsx). The record is a flat list of items; a
// person reads it as an exchange: something was said to the agent, the
// agent worked, and then it answered. So what the agent did on the way is
// folded into one line, and what it has to show stands below it.
//
// The rules are the ones the transcript view has drawn by (conversation-
// view.tsx), kept here on their own so they can be tested and so every chat
// groups a turn the same way.

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
  return { kind: "agent", id: items[0].id, steps, shown, working };
}

// transcriptTurns groups a transcript. Only its last turn can be the one
// under way, and it is while the agent says it is at work or waits on the
// person for a permission or an answer.
export function transcriptTurns(items: readonly TranscriptItem[]): TranscriptTurn[] {
  const last = items[items.length - 1];
  const live = !!last && (last.kind === "thinking" || (last.kind === "ask" && !last.decided) || (last.kind === "question" && !last.done));
  const out: TranscriptTurn[] = [];
  let run: TranscriptItem[] = [];
  const flush = (isLast: boolean) => {
    if (run.length) out.push(agentTurn(run, isLast && live));
    run = [];
  };
  for (const it of items) {
    if (!starts(it)) {
      run.push(it);
      continue;
    }
    flush(false);
    out.push(it.kind === "user" || it.kind === "command" ? { kind: "said", id: it.id, item: it } : { kind: "arrived", id: it.id, item: it });
  }
  flush(true);
  return foldPings<TranscriptTurn>(
    out,
    (t) => (t.kind === "arrived" && t.item.kind === "ping" ? t.item : undefined),
    (pings) => ({ kind: "pings", id: `pings-${pings[0].id}`, items: pings }),
  );
}
