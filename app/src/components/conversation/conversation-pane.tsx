import { ArrowUpIcon, MessagesSquareIcon, RefreshCwIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { DitherBand } from "@/components/art/dither-band";
import { HARBOUR, HARBOUR_MUTE, useHarbourLight } from "@/components/art/harbour-art";
import { ConversationView } from "@/components/conversation/conversation-view";
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { isMock } from "@/hooks/use-berth-connection";
import { startSession } from "@/lib/actions";
import { boxApi, laptopApi } from "@/lib/api";
import { keyOf, useConversations } from "@/lib/conversation-store";
import { agentLabel, agentOf, sessionState, worktreeOf } from "@/lib/derive";
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
      out.push({ kind: "ask", id: "live:ask", tool: "Question", detail: ask.detail, choices: ask.choices, decided });
    }
    return out;
  }, [mock, items, state, s?.state_since, ask, answered]);

  // Claude Code and Codex write their conversation once they start: until
  // then a new agent has nothing to read yet, which is not a dead end.
  const agent = s ? agentOf(s) : undefined;
  const readable = agent === "claude" || agent === "codex";
  if (!mock && (feed === "unsupported" || (feed === "none" && !readable))) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>{feed === "none" ? "No conversation to show" : "Conversation view needs a newer berthd"}</EmptyTitle>
            <EmptyDescription>
              {feed === "none" ? "Berth can read Claude Code's and Codex's conversations. This agent's is in its terminal." : "This box runs an older berthd that doesn't stream agents' conversations. Update it; your agents keep running while it restarts."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              {feed === "unsupported" && <UpgradeBox box={box} />}
              <Button variant="outline" onClick={onShowTerminal}>
                <SquareTerminalIcon />
                Show terminal
              </Button>
            </div>
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

  // The agent's program has ended: nothing will read a reply. Its
  // conversation stays readable; a fresh one starts beside it.
  const ended = state === "exited";
  const again = () => void startSession(agent ?? "claude", { kind: "tab" }, agent ? agentLabel(agent) : "Agent");
  if (ended && !shown.length) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>This agent has ended</EmptyTitle>
            <EmptyDescription>Its program closed, so it can't take a reply. Start a new one in this worktree, or look at what it left in its terminal.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button onClick={again}>
                <AgentIcon agent={agent} className="size-3.5" />
                Start {agent ? agentLabel(agent) : "an agent"} again
              </Button>
              <Button variant="outline" onClick={onShowTerminal}>
                <SquareTerminalIcon />
                Show terminal
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  // Nothing said yet: the same harbour, header and framed composer as an
  // empty worktree, so starting an agent looks the same either way.
  if (!shown.length && (mock || feed !== "loading")) {
    const wt = s ? worktreeOf(locations, s) : undefined;
    return <FirstPrompt box={box} agent={agent} name={wt ? (wt.worktree.main ? wt.location.name : wt.worktree.name) : session} branch={wt?.worktree.branch} onSend={reply} />;
  }

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
          {ended ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
              <span className="min-w-0 flex-1">This agent has ended, so it can't take a reply.</span>
              <Button size="sm" variant="outline" onClick={again}>
                Start {agent ? agentLabel(agent) : "an agent"} again
              </Button>
            </div>
          ) : (
            <Reply onSend={reply} blocked={state === "waiting" && !!ask?.choices.length} />
          )}
        </div>
      </div>
    </div>
  );
}

// Reply is the box at the foot. While the agent waits at a menu, Enter there
// would pick its highlighted option, so it waits for the answer above.
function Reply({ onSend, blocked }: { onSend(text: string): Promise<void>; blocked?: boolean }) {
  const [text, setText] = useState("");
  const go = () => {
    const t = text.trim();
    if (!t || blocked) return;
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
        placeholder={blocked ? "Pick an answer above first" : "Reply, or ask for something else"}
        className="max-h-40"
      />
      <InputGroupAddon align="inline-end" className="self-end pb-1.5">
        <Button size="icon-sm" aria-label="Send" disabled={!text.trim() || blocked} onClick={go}>
          <ArrowUpIcon />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}

// UpgradeBox updates the box's berthd to the build this Berth ships, the
// same as Settings → Boxes → Upgrade berthd. Agents keep running; once the
// box answers with the new build the conversation loads by itself.
function UpgradeBox({ box }: { box: string }) {
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState("");
  const upgrade = async () => {
    const client = useStore.getState().client;
    if (!client) return;
    setBusy(true);
    try {
      await laptopApi.upgrade(client, box, (l) => setLine(l));
      await useStore.getState().refreshBox(box, ["info"]);
      toastManager.add({ type: "success", title: `${box} is up to date` });
    } catch (err) {
      toastManager.add({ type: "error", title: `Couldn't update ${box}`, description: errorMessage(err) });
    } finally {
      setBusy(false);
      setLine("");
    }
  };
  const button = (
    <Button onClick={() => void upgrade()} disabled={busy}>
      {busy ? <Spinner /> : <RefreshCwIcon />}
      {busy ? `Updating ${box}…` : `Update berthd on ${box}`}
    </Button>
  );
  // While it runs, the upgrade's latest line is a hover away.
  return busy && line ? <Tip label={line}>{button}</Tip> : button;
}

// FirstPrompt is an agent that hasn't been asked anything yet: the harbour
// band, the worktree, and one framed composer for its first task.
function FirstPrompt({ box, agent, name, branch, onSend }: { box: string; agent?: string; name: string; branch?: string; onSend(text: string): Promise<void> }) {
  const light = useHarbourLight();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const who = agent ? agentLabel(agent) : "the agent";
  const go = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onSend(t);
      setText("");
    } catch (err) {
      toastManager.add({ type: "error", title: "Couldn't send it", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="absolute inset-0 overflow-y-auto bg-background">
      <DitherBand src={HARBOUR[light]} position={0.45} fade={0.5} mute={HARBOUR_MUTE[light]} className="absolute inset-x-0 top-0 h-[clamp(160px,30vh,280px)]" />
      <div className="relative flex min-h-full items-start justify-center px-6 pt-[clamp(120px,24vh,230px)] pb-10">
        <div className="w-full max-w-[560px]">
          <header className="mb-4 px-2 [text-shadow:0_0_6px_var(--background),0_0_14px_var(--background)]">
            <h1 className="truncate font-semibold text-lg tracking-tight">{name}</h1>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              {branch && <span className="min-w-0 truncate rounded bg-accent px-1.5 py-px font-mono text-[11px]">{branch}</span>}
              <span className="shrink-0 rounded bg-accent px-1.5 py-px font-mono text-[11px]">{box}</span>
            </div>
          </header>
          <Frame className="w-full shadow-lg/5">
            <FramePanel className="p-0 ring-ring/24 transition-shadow has-focus-visible:border-ring has-focus-visible:ring-[3px]">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void go();
                  }
                }}
                aria-label={`What should ${who} do?`}
                placeholder={`What should ${who} do?`}
                className="field-sizing-content block max-h-60 min-h-[76px] w-full resize-none rounded-[inherit] bg-transparent px-3.5 py-3 text-[14px] outline-none placeholder:text-muted-foreground/72"
              />
            </FramePanel>
            <FrameFooter className="flex items-center gap-1.5 px-1 pt-1 pb-0">
              <span className="flex min-w-0 items-center gap-1.5 px-2.5 text-muted-foreground text-xs">
                <AgentIcon agent={agent} className="size-3.5" />
                {who} is ready in this worktree
              </span>
              <Button size="icon-sm" className="ml-auto" aria-label="Send" disabled={!text.trim()} loading={busy} onClick={() => void go()}>
                <ArrowUpIcon />
              </Button>
            </FrameFooter>
          </Frame>
        </div>
      </div>
    </div>
  );
}
