import { ArrowUpIcon, MessagesSquareIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ConversationView } from "@/components/conversation/conversation-view";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { toastManager } from "@/components/ui/toast";
import { isMock } from "@/hooks/use-berth-connection";
import { keyOf, useConversations } from "@/lib/conversation-store";
import { sessionState, worktreeOf } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { finishTurn, seedTranscript } from "@/lib/mock-conversation";
import { send } from "@/lib/orchestrate";
import { NONE, useStore } from "@/lib/store";
import type { TranscriptItem } from "@/lib/transcript";

// ConversationPane shows an agent's pane as a conversation: the transcript,
// and a reply box docked at its foot. berthd does not stream transcripts yet,
// so outside the demo it says so and offers the terminal back.

export function ConversationPane({ box, session, onShowTerminal }: { box: string; session: string; onShowTerminal(): void }) {
  const key = keyOf(box, session);
  const items = useConversations((s) => s.items[key]) ?? (NONE as TranscriptItem[]);
  const s = useStore((st) => st.boxes[box]?.sessions?.find((x) => x.name === session));
  const stats = useStore((st) => st.boxes[box]?.stats);
  const locations = useStore((st) => st.boxes[box]?.locations);
  const mock = isMock();

  // The demo makes up a conversation for an agent opened mid-way.
  useEffect(() => {
    if (!mock || !s || useConversations.getState().items[key]) return;
    const wt = worktreeOf(locations, s);
    seedTranscript(box, session, sessionState(s, stats), wt ? (wt.worktree.main ? wt.location.name : wt.worktree.name) : session);
  }, [mock, s, key, box, session, stats, locations]);

  if (!mock) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>Conversation view needs a newer berthd</EmptyTitle>
            <EmptyDescription>This box doesn't stream agents' transcripts yet. The agent is working as usual in its terminal.</EmptyDescription>
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

  const answer = (id: string, yes: boolean) => {
    const it = items.find((i) => i.id === id);
    useConversations.getState().update(key, id, { decided: yes ? "approved" : "denied" });
    if (mock) {
      void finishTurn(box, session);
      return;
    }
    // A permission prompt takes its option's number; a question, a word.
    const keys = it?.kind === "ask" && it.tool !== "Question" ? (yes ? "1" : "\u001b") : yes ? "yes" : "no";
    send(box, session, keys, { enter: it?.kind === "ask" && it.tool === "Question", force: true }).catch((err) =>
      toastManager.add({ type: "error", title: "Couldn't answer", description: errorMessage(err) }),
    );
  };

  const reply = async (text: string) => {
    useConversations.getState().push(key, { kind: "user", id: `u${Date.now()}`, text });
    if (mock) void finishTurn(box, session);
    else await send(box, session, text, { when: "idle" });
  };

  return (
    // The column steps left of the floating loops panel when there is room.
    <div className="@container relative flex min-h-0 flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto pt-6 pb-4 pl-6 pr-6 @[1000px]:pr-[max(24px,var(--berth-loops-w,0px))]">
        <ConversationView items={items} onAnswer={answer} />
      </div>
      <div className="pb-4 pl-6 pr-6 @[1000px]:pr-[max(24px,var(--berth-loops-w,0px))]">
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
