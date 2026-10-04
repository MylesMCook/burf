import { ArrowUpIcon, ListPlusIcon, MessageSquareTextIcon, MessagesSquareIcon, RefreshCwIcon, SendIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { DitherBand } from "@/components/art/dither-band";
import { TaskComposer } from "@/components/conversation/task-composer";
import { HARBOUR, HARBOUR_MUTE, useHarbourLight } from "@/components/art/harbour-art";
import { Scene, type SceneName } from "@/components/art/scenes";
import { ConversationView, type EditActions, QueuedBubble } from "@/components/conversation/conversation-view";
import { toastError } from "@/components/error-note";
import { UpgradeBox } from "@/components/upgrade-box";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { isMock } from "@/hooks/use-berth-connection";
import { startSession } from "@/lib/actions";
import { ApiError, boxApi, type QueuedPrompt } from "@/lib/api";
import { keyOf, useConversations } from "@/lib/conversation-store";
import { agentLabel, agentOf, guessAgent, sessionState, worktreeOf } from "@/lib/derive";
import type { NextStep } from "@/lib/errors";
import { finishTurn, seedTranscript } from "@/lib/mock-conversation";
import { useNotifications } from "@/lib/notifications";
import { updateBoxes } from "@/lib/outdated";
import { addComment, type LineComment, pending, removeComment, sendComments, useComments } from "@/lib/review-comments";
import { permissionChoices } from "@/lib/screen";
import { NONE, useStore } from "@/lib/store";
import type { TranscriptItem } from "@/lib/transcript";
import { useAsk, useQueued, useTranscriptFeed } from "@/lib/transcript-feed";
import { ConfirmDialog } from "@/views/settings/confirm";
import { useReview } from "@/views/review/review-store";

// ConversationPane shows an agent's pane as a conversation: the transcript,
// and a reply box docked at its foot. On a box that streams transcripts it
// reads the agent's own; "Thinking…" and the question come from the
// session's live state and its screen. The demo plays a scripted turn
// instead. Without either it says so and offers the terminal back.

//
// It never claims more than it knows. Until the box lists its sessions it
// reads; a session the box no longer lists, or whose program closed, has
// ended (and never offers a reply); a box that is away says so and the pane
// comes back by itself when it returns; a conversation that can't be read
// says why, with a way to try again.
export function ConversationPane({ box, session, agent: remembered, visible, onShowTerminal, onStartAgain }: { box: string; session: string; agent?: string; visible: boolean; onShowTerminal(): void; onStartAgain?(): void }) {
  const key = keyOf(box, session);
  const items = useConversations((s) => s.items[key]) ?? (NONE as TranscriptItem[]);
  const listed = useStore((st) => st.boxes[box]?.sessions);
  const s = listed?.find((x) => x.name === session);
  const stats = useStore((st) => st.boxes[box]?.stats);
  const locations = useStore((st) => st.boxes[box]?.locations);
  const client = useStore((st) => st.client);
  const boxStatus = useStore((st) => st.status?.boxes.find((b) => b.name === box));
  const mock = isMock();
  const away = !!boxStatus && boxStatus.state !== "online";
  // Gone: the box lists its sessions and this one isn't among them.
  const gone = !away && !!listed && !s;
  const state = gone ? "exited" : s ? sessionState(s, stats) : undefined;
  const [attempt, setAttempt] = useState(0);
  const feed = useTranscriptFeed(box, session, s?.dir, visible && !mock && !away, attempt);
  const ask = useAsk(box, session, !mock && state === "waiting", s?.state_since);
  const [answered, setAnswered] = useState<{ at?: string; key: string }>();
  const queue = useQueued(box, session, s?.queued, visible);
  const [confirm, setConfirm] = useState<QueuedPrompt>();
  const canDiff = useStore((st) => !!st.boxes[box]?.info?.capabilities?.includes("diff"));
  // A session the box no longer lists is named from what the pane remembers.
  const agent = (s ? agentOf(s) : undefined) ?? remembered ?? guessAgent(session);
  const who = agent === "claude" ? "Claude" : agent ? agentLabel(agent) : "The agent";
  // Comments on the diff are kept per worktree, as Review keys them.
  const wt = s ? worktreeOf(locations, s) : undefined;
  const reviewKey = wt ? `${box}|${wt.worktree.path}` : undefined;
  const comments = useComments((st) => (reviewKey ? st.byKey[reviewKey] : undefined)) ?? NO_COMMENTS;

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
    const decided = answered && answered.at === s?.state_since ? answered.key : undefined;
    if (state === "waiting" && s?.ask?.tool) {
      // The agent's hooks said what it asks: show that, with its screen's
      // options matched to Allow, Always allow and Deny.
      const choices = ask ? (permissionChoices(ask.choices) ?? ask.choices) : [];
      out.push({ kind: "ask", id: "live:ask", tool: s.ask.tool, detail: s.ask.input ?? "", why: s.ask.why, structured: true, choices, reading: !ask, decided });
    } else if (state === "waiting" && ask) {
      out.push({ kind: "ask", id: "live:ask", tool: "Question", detail: s?.ask?.message || ask.detail, choices: ask.choices, decided });
    }
    return out;
  }, [mock, items, state, s?.state_since, s?.ask, ask, answered]);

  const edits = useMemo<EditActions | undefined>(() => {
    if (!client || (!canDiff && !mock)) return undefined;
    return {
      load: (file) => boxApi.diff(client, box, session, file),
      comments: (file) =>
        reviewKey
          ? {
              list: comments.filter((c) => c.file === file),
              onAdd: (line, side, text) => addComment(reviewKey, { file, line, side, text }),
              onRemove: (id) => removeComment(reviewKey, id),
            }
          : undefined,
      review: (file) => {
        if (!reviewKey) return;
        useComments.setState({ focus: { key: reviewKey, file } });
        useNotifications.setState({ reviewFocus: reviewKey });
        useStore.getState().setView({ kind: "review" });
        if (!useReview.getState().entries.some((e) => e.key === reviewKey))
          toastManager.add({ type: "info", title: "Not in Review yet", description: `Review lists this worktree once ${who} finishes its turn.` });
      },
    };
  }, [client, canDiff, mock, box, session, reviewKey, comments, who]);

  // Claude Code and Codex write their conversation once they start: until
  // then a new agent has nothing to read yet, which is not a dead end.
  const readable = agent === "claude" || agent === "codex";
  const ended = state === "exited";
  // In its own pane when the pane says how; otherwise a new tab.
  const again = () => (onStartAgain ? onStartAgain() : void startSession(agent ?? "claude", { kind: "tab" }, agent ? agentLabel(agent) : "Agent"));

  // The box is away: what it last said may be stale, so say only that.
  if (away && !mock) {
    return (
      <PaneEmpty
        scene="offline"
        title={boxStatus?.state === "connecting" ? `Connecting to ${box}…` : `${box} is ${boxWord(boxStatus?.state)}`}
        description={`${agent ? agentLabel(agent) : "The agent"} ${s?.exited ? "had ended before then" : "keeps running there"}. This comes back by itself when ${box} is reachable again.`}
      >
        <Button variant="outline" onClick={() => void useStore.getState().refreshAll()}>
          <RefreshCwIcon />
          Retry now
        </Button>
      </PaneEmpty>
    );
  }
  // Not known yet: the box hasn't listed its sessions.
  if (!mock && !listed) return <Reading />;

  if (!mock && feed === "error" && !items.length && !ended) {
    return (
      <PaneEmpty scene="storm" title="Couldn't read the conversation" description={`${box} didn't answer with it. The agent is unaffected; its terminal shows the same work.`}>
        <Button onClick={() => setAttempt((n) => n + 1)}>
          <RefreshCwIcon />
          Retry
        </Button>
        <Button variant="outline" onClick={onShowTerminal}>
          <SquareTerminalIcon />
          Show terminal
        </Button>
      </PaneEmpty>
    );
  }
  if (!mock && !ended && (feed === "unsupported" || (feed === "none" && !readable))) {
    return (
      <PaneEmpty
        title={feed === "none" ? `${agent ? agentLabel(agent) : "This agent"} works in its terminal` : `${box} needs an update for this`}
        description={
          feed === "none"
            ? "Berth can show Claude Code's and Codex's conversations here. This agent's work is in its terminal."
            : `${box} runs an older berthd that doesn't stream agents' conversations. Updating keeps your agents running.`
        }
      >
        {feed === "unsupported" && <UpgradeBox box={box} />}
        <Button variant="outline" onClick={onShowTerminal}>
          <SquareTerminalIcon />
          Show terminal
        </Button>
      </PaneEmpty>
    );
  }
  const onStep = (step: NextStep) => (step === "start-again" ? again() : step === "show-terminal" ? onShowTerminal() : step === "update-box" ? void updateBoxes([box]) : undefined);
  const fail = (err: unknown) => toastError(err, { title: "Couldn't send it", box, onStep });

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
      toastError(err, { title: "Couldn't answer", box, onStep });
    });
  };

  const reply = async (text: string) => {
    if (mock && state !== "running") {
      useConversations.getState().push(key, { kind: "user", id: `u${Date.now()}`, text });
      void finishTurn(box, session);
      return;
    }
    if (!client) return;
    // Typed for the person, at once when the agent waits for them, else
    // held until it is idle; the transcript shows it once the agent reads it.
    const r = await boxApi.send(client, box, session, text, true, state === "waiting" ? { when: "now", force: true } : { when: "idle" });
    if (r.queued) queue.refresh();
  };

  // A held prompt typed now. At a question it would be read as the answer,
  // so that asks first (force).
  const sendNow = async (q: QueuedPrompt, force = false) => {
    if (!client) return;
    if (state === "waiting" && !force) {
      setConfirm(q);
      return;
    }
    try {
      await boxApi.sendQueued(client, box, session, q.turn, force);
      if (mock) useConversations.getState().push(key, { kind: "user", id: `u${Date.now()}`, text: q.preview });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConfirm(q);
      else toastError(err, { title: "Couldn't send it now", box, onStep });
    } finally {
      queue.refresh();
    }
  };
  const cancel = async (q: QueuedPrompt) => {
    if (!client) return;
    try {
      await boxApi.unqueue(client, box, session, q.turn);
    } catch (err) {
      toastError(err, { title: "Couldn't cancel it", box, onStep });
    } finally {
      queue.refresh();
    }
  };
  const tail = queue.items.length ? queue.items.map((q) => <QueuedBubble key={q.turn} q={q} who={who} onSendNow={() => sendNow(q)} onCancel={() => cancel(q)} />) : null;
  const toSend = pending(comments);
  // An agent at a menu (a permission, or numbered options) takes its answer
  // from the buttons above: Enter in the reply box would pick for it.
  const open = [...shown].reverse().find((it) => it.kind === "ask");
  const atMenu = !!ask?.choices.length || !!s?.ask?.tool || (open?.kind === "ask" && !open.decided && (!!open.choices?.length || !!open.structured));

  if (ended && !shown.length) {
    return (
      <PaneEmpty
        scene="ended"
        title={`${agent ? agentLabel(agent) : "This agent"} has ended`}
        description={gone ? `Its session is no longer on ${box}, so it can't take a reply. Start a new one in this worktree.` : "Its program closed, so it can't take a reply. Start a new one in this worktree, or look at what it left in its terminal."}
      >
        <Button onClick={again}>
          <AgentIcon agent={agent} className="size-3.5" />
          Start {agent ? agentLabel(agent) : "an agent"} again
        </Button>
        {!gone && (
          <Button variant="outline" onClick={onShowTerminal}>
            <SquareTerminalIcon />
            Show terminal
          </Button>
        )}
      </PaneEmpty>
    );
  }

  // Nothing said yet, by an agent that is open and at rest: the same
  // harbour, header and framed composer as an empty worktree, so starting an
  // agent looks the same either way. Never for one still reading, or one
  // that is working or waiting (those show what they are doing).
  if (!shown.length && (mock || feed === "ready" || feed === "none") && state !== "running" && state !== "waiting") {
    const wt = s ? worktreeOf(locations, s) : undefined;
    return <FirstPrompt box={box} session={session} agent={agent} name={wt ? (wt.worktree.main ? wt.location.name : wt.worktree.name) : session} branch={wt?.worktree.branch} onSend={reply} onFail={fail} />;
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
          <ConversationView items={shown} onAnswer={answer} edits={edits} who={who} tail={tail} tailSize={queue.items.length} />
        )}
      </div>
      <div className="pr-6 pb-4 pl-6 @[1000px]:pr-[max(24px,var(--berth-loops-w,0px))]">
        <div className="mx-auto w-full max-w-[680px]">
          {ended ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
              <StateGlyph state="exited" />
              <span className="min-w-0 flex-1">{agent ? agentLabel(agent) : "This agent"} has ended, so it can't take a reply.</span>
              <Button size="sm" variant="outline" onClick={again}>
                Start {agent ? agentLabel(agent) : "an agent"} again
              </Button>
            </div>
          ) : (
            <>
              {toSend.length > 0 && reviewKey && <CommentsStrip count={toSend.length} who={who} onSend={() => sendComments(box, session, reviewKey)} />}
              <Reply onSend={reply} onFail={fail} who={who} mode={state === "running" ? "queue" : state === "waiting" ? "answer" : "send"} blocked={state === "waiting" && atMenu} />
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        title={s?.ask?.tool ? `${who} is waiting for your permission` : `${who} is waiting on a question`}
        description={
          s?.ask?.tool
            ? `Sending now types your message into its permission prompt, where a key can pick one of its options. Answer the prompt first, or leave this queued to send once ${who} finishes.`
            : `Sending now types your message into its question, where ${who} reads it as the answer. Leave it queued to send it once ${who} finishes.`
        }
        confirm={s?.ask?.tool ? "Send anyway" : "Send as the answer"}
        onConfirm={() => (confirm ? sendNow(confirm, true) : undefined)}
      />
    </div>
  );
}

const NO_COMMENTS: LineComment[] = [];

// CommentsStrip offers the comments left on this worktree's diff to its
// agent, as one short prompt held until it is idle.
function CommentsStrip({ count, who, onSend }: { count: number; who: string; onSend(): Promise<{ sent: number; left: number; queued: boolean }> }) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await onSend();
      toastManager.add({ type: "success", title: `Sent ${r.sent} comment${r.sent === 1 ? "" : "s"} to ${who}`, description: r.queued ? `Queued: ${who} gets them when it finishes.` : r.left ? `${r.left} more didn't fit; send again.` : undefined });
    } catch (err) {
      toastError(err, { title: "Couldn't send the comments" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-3 text-sm">
      <MessageSquareTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        {count} comment{count === 1 ? "" : "s"} on the diff
      </span>
      <Button size="xs" loading={busy} onClick={() => void send()}>
        <SendIcon />
        Send to {who}
      </Button>
    </div>
  );
}

// Reply is the box at the foot, and says what Enter does: send now, queue
// it until the agent finishes, or answer the agent's question. While the
// agent waits at a menu, Enter there would pick its highlighted option, so
// it waits for the answer above.
function Reply({ onSend, onFail, who, mode, blocked }: { onSend(text: string): Promise<void>; onFail(err: unknown): void; who: string; mode: "send" | "queue" | "answer"; blocked?: boolean }) {
  const [text, setText] = useState("");
  const go = () => {
    const t = text.trim();
    if (!t || blocked) return;
    setText("");
    onSend(t).catch((err) => {
      // What was typed comes back, so nothing is lost.
      setText((now) => now || t);
      onFail(err);
    });
  };
  const queue = mode === "queue";
  const placeholder = blocked ? "Pick an answer above first" : queue ? `${who} is working: Enter queues this for when it finishes` : mode === "answer" ? `Answer ${who}, or ask for something else` : "Reply, or ask for something else";
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
        placeholder={placeholder}
        className="max-h-40"
      />
      <InputGroupAddon align="inline-end" className="self-end pr-1.5 pb-1.5">
        <Tip
          label={
            <span className="flex items-center gap-1.5">
              {queue ? `Queue it for when ${who} finishes` : "Send"} <Kbd>↵</Kbd>
            </span>
          }
        >
          <Button size="icon-sm" className="rounded-lg" variant={queue ? "outline" : "default"} aria-label={queue ? "Queue" : "Send"} disabled={!text.trim() || blocked} onClick={go}>
            {queue ? <ListPlusIcon /> : <ArrowUpIcon />}
          </Button>
        </Tip>
      </InputGroupAddon>
    </InputGroup>
  );
}

// PaneEmpty is one of the pane's quiet states: a scene, what happened, and
// what to do next.
function PaneEmpty({ scene, title, description, children }: { scene?: SceneName; title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Empty>
        <EmptyHeader>
          {scene ? (
            <div className="mb-2 text-muted-foreground/80">
              <Scene name={scene} width={136} />
            </div>
          ) : (
            <EmptyMedia variant="icon">
              <MessagesSquareIcon />
            </EmptyMedia>
          )}
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {children && (
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-2">{children}</div>
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

function Reading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground text-sm">
      <Spinner className="mr-2 size-4" />
      Reading the conversation…
    </div>
  );
}

const boxWord = (state?: string) => (state === "untrusted" ? "unreachable" : (state ?? "offline"));

// FirstPrompt is an agent that hasn't been asked anything yet: the harbour
// band, the worktree, and the composer for its first task, as everywhere
// work starts.
function FirstPrompt({ box, session, agent, name, branch, onSend, onFail }: { box: string; session: string; agent?: string; name: string; branch?: string; onSend(text: string): Promise<void>; onFail(err: unknown): void }) {
  const light = useHarbourLight();
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
          <TaskComposer to={{ box, session, agent }} onSend={onSend} onFail={onFail} autoFocus />
        </div>
      </div>
    </div>
  );
}
