import { AssistantRuntimeProvider, makeAssistantDataUI, useAuiState, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { AssistantMessage, Thread } from "@/components/assistant-ui/elements/thread.aui";
import { PingGroup } from "@/components/conversation/agent-message";
import { type EditActions, Item, ReadOnlyContext, WorkFold } from "@/components/conversation/conversation-view";
import { type PingItem, withoutReminders } from "@/lib/agent-messages";
import type { TranscriptItem } from "@/lib/transcript";
import { transcriptTurns, type TranscriptTurn } from "@/lib/transcript-thread";

// A session's transcript drawn by the same thread as a structured chat
// (chat-thread.tsx): one viewport, one message shape, one markdown. What
// the person said is a user message and what the agent said is text, as in
// any chat; everything a transcript has beyond words (its folded steps, an
// edit, a question, a notice, a report) is a data part drawn by Burf's own
// card for it. lib/transcript-thread.ts makes the turns.

interface Acts {
  who: string;
  onAnswer(id: string, key: string): void;
  edits?: EditActions;
}
const ActsContext = createContext<Acts>({ who: "The agent", onAnswer: () => {} });

const done = { type: "complete", reason: "stop" } as const;

// own: a message that is not the agent's words, drawn without its name: a
// command the person typed, or what reached the agent from elsewhere.
type Own = { item: TranscriptItem } | { pings: PingItem[] };

function message(turn: TranscriptTurn): ThreadMessageLike {
  switch (turn.kind) {
    case "said":
      if (turn.item.kind === "user") return { id: turn.id, role: "user", content: [{ type: "text", text: withoutReminders(turn.item.text) }] };
      return { id: turn.id, role: "assistant", status: done, content: [], metadata: { custom: { own: { item: turn.item } } } };
    case "arrived":
      return { id: turn.id, role: "assistant", status: done, content: [], metadata: { custom: { own: { item: turn.item } } } };
    case "pings":
      return { id: turn.id, role: "assistant", status: done, content: [], metadata: { custom: { own: { pings: turn.items } } } };
    case "agent":
      return {
        id: turn.id,
        role: "assistant",
        status: turn.working ? { type: "running" } : done,
        content: [
          ...(turn.steps.length ? [{ type: "data-steps" as const, data: { id: `fold-${turn.steps[0].id}`, steps: turn.steps, working: turn.working } }] : []),
          // A draft is still being read from the agent's screen: Burf's own
          // card draws it, marked as one, until the record has the words.
          ...turn.shown.map((it) => (it.kind === "text" && !it.live ? { type: "text" as const, text: it.text } : { type: "data-item" as const, data: it })),
        ],
      };
  }
}

function Shown({ it }: { it: TranscriptItem }) {
  const { who, onAnswer, edits } = useContext(ActsContext);
  return (
    <div className="py-1.5 text-[0.875rem]">
      <Item it={it} onAnswer={onAnswer} edits={edits} who={who} />
    </div>
  );
}

const ItemUI = makeAssistantDataUI<TranscriptItem>({ name: "item", render: ({ data }) => <Shown it={data} /> });

const StepsUI = makeAssistantDataUI<{ id: string; steps: TranscriptItem[]; working: boolean }>({
  name: "steps",
  render: function Steps({ data }) {
    const { who, onAnswer, edits } = useContext(ActsContext);
    return (
      <div className="py-1.5">
        <WorkFold id={data.id} steps={data.steps} live={data.working} onAnswer={onAnswer} edits={edits} who={who} />
      </div>
    );
  },
});

function Message() {
  const own = (useAuiState((s) => s.message.metadata.custom) as { own?: Own } | undefined)?.own;
  if (!own) return <AssistantMessage />;
  return <div className="min-w-0 px-2 text-[0.875rem]">{"pings" in own ? <PingGroup items={own.pings} /> : <Shown it={own.item} />}</div>;
}

const components = { AssistantMessage: Message };
const sent = async () => {};
const none = <></>;

// Nothing a person said survives as an empty message: a prompt that was
// only a reminder to the agent is not theirs to read.
const said = (turn: TranscriptTurn) => turn.kind !== "said" || turn.item.kind !== "user" || !!withoutReminders(turn.item.text);

export function TranscriptThread({ items, who = "The agent", readOnly = false, onAnswer, edits, composer = none, welcome = none, after }: { items: readonly TranscriptItem[]; readOnly?: boolean; composer?: ReactNode; welcome?: ReactNode; after?: ReactNode } & Partial<Acts>) {
  // A record being read back is not under way, whatever it ended on.
  const turns = useMemo(() => transcriptTurns(items).filter(said).map((turn) => (readOnly && turn.kind === "agent" && turn.working ? { ...turn, working: false } : turn)), [items, readOnly]);
  const working = turns[turns.length - 1]?.kind === "agent" && (turns[turns.length - 1] as Extract<TranscriptTurn, { kind: "agent" }>).working;
  const runtime = useExternalStoreRuntime({ messages: turns, isRunning: working, convertMessage: message, onNew: sent });
  const acts = useMemo<Acts>(() => ({ who, onAnswer: onAnswer ?? (() => {}), edits: readOnly ? undefined : edits }), [who, onAnswer, edits, readOnly]);
  const speakers = useMemo(() => ({ user: "You", assistant: who }), [who]);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ReadOnlyContext.Provider value={readOnly}>
        <ActsContext.Provider value={acts}>
          <ItemUI />
          <StepsUI />
          <Thread components={components} autoFocus={false} composer={composer} welcome={welcome} after={after} speakers={speakers} loadEarlier={false} />
        </ActsContext.Provider>
      </ReadOnlyContext.Provider>
    </AssistantRuntimeProvider>
  );
}
