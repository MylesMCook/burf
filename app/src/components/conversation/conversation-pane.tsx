import { ArrowUpIcon, MessagesSquareIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ConversationView } from "@/components/conversation/conversation-view";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { isMock } from "@/hooks/use-berth-connection";
import { boxApi } from "@/lib/api";
import { keyOf, useConversations } from "@/lib/conversation-store";
import { sessionState, worktreeOf } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { finishTurn, seedTranscript } from "@/lib/mock-conversation";
import { NONE, useStore } from "@/lib/store";
import type { TranscriptItem } from "@/lib/transcript";
import { useAsk, useTranscriptFeed } from "@/lib/transcript-feed";

// ConversationPane shows an agent's pane as a conversation: the transcript,
// and a reply box docked at its foot. On a box that streams transcripts it
// reads the agent's own; "Thinking…" and the question come from the
// session's live state and its screen. The demo plays a scripted turn
// instead. Without either it says so and offers the terminal back.

export function ConversationPane({ box, session, visible, onShowTerminal }: { box: string; session: string; visible: boolean; onShowTerminal(): void }) {
  const key = keyOf(box, session);
  const items = useConversations((s) => s.items[key]) ?? (NONE as TranscriptItem[]);
  const s = useStore((st) => st.boxes[box]?.sessions?.find((x) => x.name === session));
  const stats = useStore((st) => st.boxes[box]?.stats);
  const locations = useStore((st) => st.boxes[box]?.locations);
  const client = useStore((st) => st.client);
  const mock = isMock();
  const state = s ? sessionState(s, stats) : undefined;
  const feed = useTranscriptFeed(box, session, s?.dir, visible && !mock);
  const ask = useAsk(box, session, !mock && state === "waiting", s?.state_since);
  const [answered, setAnswered] = useState<{ at?: string; key: string }>();

  // The demo makes up a conversation for an agent opened mid-way.
  useEffect(() => {
    if (!mock || !s || useConversations.getState().items[key]) return;
    const wt = worktreeOf(locations, s);
    seedTranscript(box, session, sessionState(s, stats), wt ? (wt.worktree.main ? wt.location.name : wt.worktree.name) : session);
  }, [mock, s, key, box, session, stats, locations]);

  // What the box does not send, from the session's state: thinking while it
  // works, its question while it waits.
  const shown = useMemo(() => {
    if (mock) return items;
    const out = [...items];
    if (state === "running" && s?.state_since) out.push({ kind: "thinking", id: "live:thinking", since: new Date(s.state_since).getTime() });
    if (state === "waiting" && ask) {
      const decided = answered && answered.at === s?.state_since ? answered.key : undefined;
      out.push({ kind: "ask", id: "live:ask", tool: ask.choices.length ? "Choice" : "Question", detail: ask.detail, choices: ask.choices, decided });
    }
    return out;
  }, [mock, items, state, s?.state_since, ask, answered]);

  if (!mock && (feed === "unsupported" || feed === "none")) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>{feed === "none" ? "No conversation to show" : "Conversation view needs a newer berthd"}</EmptyTitle>
            <EmptyDescription>
              {feed === "none" ? "Berth can read Claude Code's and Codex's conversations. This agent's is in its terminal." : "This box doesn't stream agents' conversations yet. The agent is working as usual in its terminal."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={onShowTerminal}>
              <SquareTerminalIcon />
              Show terminal
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const answer = (id: string, choice: string) => {
    if (mock) {
      useConversations.getState().update(key, id, { decided: choice });
      void finishTurn(box, session);
      return;
    }
    if (!client) return;
    setAnswered({ at: s?.state_since, key: choice });
    // The person is answering, so the box may type into a waiting agent:
    // a numbered option is its digit; a plain question, the word.
    const numbered = ask?.choices.some((c) => c.key === choice);
    boxApi.send(client, box, session, choice, !numbered, { when: "now", force: true }).catch((err) => {
      setAnswered(undefined);
      toastManager.add({ type: "error", title: "Couldn't answer", description: errorMessage(err) });
    });
  };

  const reply = async (text: string) => {
    if (mock) {
      useConversations.getState().push(key, { kind: "user", id: `u${Date.now()}`, text });
      void finishTurn(box, session);
      return;
    }
    if (!client) return;
    // Typed for the person, at once when the agent waits for them, else
    // held until it is idle; the transcript shows it once the agent reads it.
    await boxApi.send(client, box, session, text, true, state === "waiting" ? { when: "now", force: true } : { when: "idle" });
  };

  return (
    // The column steps left of the floating loops panel when there is room.
    <div className="@container relative flex min-h-0 flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto pt-6 pr-6 pb-4 pl-6 @[1000px]:pr-[max(24px,var(--berth-loops-w,0px))]">
        {!mock && feed === "loading" && !items.length ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            <Spinner className="mr-2 size-4" />
            Reading the conversation…
          </div>
        ) : (
          <ConversationView items={shown} onAnswer={answer} />
        )}
      </div>
      <div className="pr-6 pb-4 pl-6 @[1000px]:pr-[max(24px,var(--berth-loops-w,0px))]">
        <div className="mx-auto w-full max-w-[680px]">
          <Reply onSend={reply} />
        </div>
      </div>
    </div>
  );
}

function Reply({ onSend }: { onSend(text: string): Promise<void> }) {
  const [text, setText] = useState("");
  const go = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    onSend(t).catch((err) => toastManager.add({ type: "error", title: "Couldn't send it", description: errorMessage(err) }));
  };
  return (
    <InputGroup className="**:[textarea]:min-h-0! **:[textarea]:py-2.5!">
      <InputGroupTextarea
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            go();
          }
        }}
        aria-label="Reply"
        placeholder="Reply, or ask for something else"
        className="max-h-40"
      />
      <InputGroupAddon align="inline-end" className="self-end pb-1.5">
        <Button size="icon-sm" aria-label="Send" disabled={!text.trim()} onClick={go}>
          <ArrowUpIcon />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
