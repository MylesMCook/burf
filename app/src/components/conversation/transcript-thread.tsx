import { AssistantRuntimeProvider, makeAssistantDataUI, MessagePrimitive, ThreadPrimitive, unstable_useThreadMessageIds, useAuiState, useExternalStoreRuntime } from "@assistant-ui/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClockIcon, RotateCwIcon } from "lucide-react";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { PingGroup } from "@/components/conversation/agent-message";
import { type EditActions, Item, ReadOnlyContext, RevealContext, WorkFold } from "@/components/conversation/transcript-item";
import { ChatList, type ChatListProps } from "@/components/conversation/chat-list";
import { ChatSearch, plainMarkdown } from "@/components/conversation/chat-search";
import { ArtifactJumper } from "@/components/conversation/artifacts";
import { SelectionActions } from "@/components/conversation/selection-actions";
import { PromptActionsContext, type PromptContext } from "@/components/conversation/prompt-actions";
import { HelperSheetHost } from "@/components/conversation/subagent-view";
import { TurnSync } from "@/components/workspace/compare-sync";
import { PixelLoader } from "@/components/pixel-loader";
import { Button } from "@/components/ui/button";
import { reportName, reportWord } from "@/components/conversation/report-card";
import { messageText, type PingItem, withoutReminders } from "@/lib/agent-messages";
import { toolSummary, type TranscriptItem } from "@/lib/transcript";
import { estimateTurn, newTurnCache, transcriptMessage, transcriptSearchEntries, transcriptTurns, type TranscriptTurn } from "@/lib/transcript-thread";
import { isMock } from "@/hooks/use-burf-connection";
import { keyOf } from "@/lib/conversation-store";
import { applyCut, dropOlder, loadOlder, meta, restoreOlder, setCut, useHasHistory, useHistory, useOlder } from "@/lib/history";
import { seedLongChat } from "@/lib/mock-history";
import { cn } from "@/lib/utils";

// Each transcript turn is one runtime message. All its items, including
// words, use Burf's cards so actions and draft marks stay with the item.
interface Acts {
  who: string;
  onAnswer(id: string, key: string): void;
  edits?: EditActions;
}
const ActsContext = createContext<Acts>({ who: "The agent", onAnswer: () => {} });

function Shown({ it }: { it: TranscriptItem }) {
  const { who, onAnswer, edits } = useContext(ActsContext);
  return <Item it={it} onAnswer={onAnswer} edits={edits} who={who} />;
}
const ItemUI = makeAssistantDataUI<TranscriptItem>({ name: "item", render: ({ data }) => <Shown it={data} /> });
const PingsUI = makeAssistantDataUI<PingItem[]>({ name: "pings", render: ({ data }) => <PingGroup items={data} /> });
const StepsUI = makeAssistantDataUI<{ id: string; steps: TranscriptItem[]; working: boolean }>({
  name: "steps",
  render: function Steps({ data }) {
    const { who, onAnswer, edits } = useContext(ActsContext);
    return <WorkFold id={data.id} steps={data.steps} live={data.working} onAnswer={onAnswer} edits={edits} who={who} />;
  },
});

// A turn at work says so with Burf's own item (what the agent is doing, and
// for how long), so assistant-ui's mark for a running message stays out.
const PARTS = { Empty: () => null };

function Message() {
  const role = useAuiState((s) => s.message.role);
  const own = useAuiState((s) => s.message.metadata.custom.own === true);
  const { who } = useContext(ActsContext);
  return (
    <MessagePrimitive.Root role={own ? undefined : "article"} aria-label={own ? undefined : role === "user" ? "You" : who} data-role={role} className="flex min-w-0 flex-col gap-4 text-[0.875rem] leading-relaxed">
      <MessagePrimitive.Parts components={PARTS} />
    </MessagePrimitive.Root>
  );
}
const components = { UserMessage: Message, AssistantMessage: Message };
const sent = async () => {};
const none = <></>;
const said = (turn: TranscriptTurn) => turn.kind !== "said" || turn.item.kind !== "user" || !!withoutReminders(turn.item.text);
const rowKey = (turn: TranscriptTurn) => turn.id;
const isTurn = (turn: TranscriptTurn) => turn.kind === "said" && turn.item.kind === "user";
const renderTurn = (turn: TranscriptTurn) => <ThreadPrimitive.Unstable_MessageById messageId={turn.id} components={components} />;

function useTurns(items: readonly TranscriptItem[], readOnly: boolean) {
  const cache = useRef<ReturnType<typeof newTurnCache> | null>(null);
  cache.current ??= newTurnCache();
  return useMemo(() => transcriptTurns(items, cache.current!, readOnly).filter(said), [items, readOnly]);
}

function TranscriptRuntime({ turns, who, onAnswer, edits, readOnly, children }: { turns: TranscriptTurn[]; readOnly: boolean; children: ReactNode } & Acts) {
  const last = turns[turns.length - 1];
  const runtime = useExternalStoreRuntime({ messages: turns, isRunning: last?.kind === "agent" && last.working, convertMessage: transcriptMessage, onNew: sent });
  const answerTo = useRef(onAnswer);
  answerTo.current = onAnswer;
  const answer = useCallback((id: string, key: string) => answerTo.current(id, key), []);
  const acts = useMemo<Acts>(() => ({ who, onAnswer: answer, edits: readOnly ? undefined : edits }), [who, answer, edits, readOnly]);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ReadOnlyContext.Provider value={readOnly}>
        <ActsContext.Provider value={acts}>
          <ItemUI /><StepsUI /><PingsUI />
          {children}
        </ActsContext.Provider>
      </ReadOnlyContext.Provider>
    </AssistantRuntimeProvider>
  );
}

export function TranscriptThread({ items, who = "The agent", readOnly = false, onAnswer = sent, edits, welcome = none, after }: { items: readonly TranscriptItem[]; readOnly?: boolean; welcome?: ReactNode; after?: ReactNode } & Partial<Acts>) {
  const turns = useTurns(items, readOnly);
  const speakers = useMemo(() => ({ user: "You", assistant: who }), [who]);
  return (
    <TranscriptRuntime turns={turns} who={who} onAnswer={onAnswer} edits={edits} readOnly={readOnly}>
      <Thread components={components} autoFocus={false} readOnly welcome={welcome} after={after} speakers={speakers} loadEarlier={false} />
    </TranscriptRuntime>
  );
}

// The runtime supplies row ids; ChatList owns scrolling and virtualization.
function RuntimeList({ turns, ...props }: { turns: TranscriptTurn[] } & Omit<ChatListProps<TranscriptTurn>, "rows" | "rowKey" | "estimate" | "render">) {
  const ids = unstable_useThreadMessageIds();
  const byId = useMemo(() => new Map(turns.map((turn) => [turn.id, turn])), [turns]);
  const rows = useMemo(() => ids.map((id) => byId.get(id)!).filter(Boolean), [ids, byId]);
  return <ChatList {...props} rows={rows} rowKey={rowKey} estimate={estimateTurn} render={renderTurn} />;
}

export interface TranscriptListProps {
  items: TranscriptItem[];
  // An answer to an ask: one of its choices' keys, or "yes" or "no".
  onAnswer(id: string, key: string): void;
  // Edits open to their file's diff when the caller can read one.
  edits?: EditActions;
  // The agent's short name, for "Claude wants to run".
  who?: string;
  // Drawn after the transcript: prompts held for the agent.
  tail?: ReactNode;
  tailSize?: number;
  className?: string;
  // Imported history has no live permissions, file actions or session control.
  readOnly?: boolean;
  // The session this is the chat of: older turns load as it scrolls up,
  // ⌘F finds in it, and prompts can be edited, forked and rewound (idle:
  // the agent rests, so a rewind can drive it).
  // A chat hidden for a minute (another tab, another worktree) lets its
  // older turns go too.
  chat?: { box: string; session: string; agent?: string; idle?: boolean; visible?: boolean };
}

export function TranscriptList({ items: live, onAnswer, edits, who = "The agent", tail, tailSize = 0, className, chat: liveChat, readOnly = false }: TranscriptListProps) {
  const chat = readOnly ? undefined : liveChat;
  if (readOnly) edits = undefined;
  const key = chat ? keyOf(chat.box, chat.session) : "";
  const history = useHasHistory(chat?.box ?? "") && !!chat;
  const older = useOlder(key);
  const cut = useHistory((st) => (key ? st.cut[key] : undefined));
  // A closed chat lets its older turns go, so memory stays bounded.
  useEffect(() => () => void (key && dropOlder(key)), [key]);
  useEffect(() => {
    if (!key || chat?.visible !== false) return;
    const t = window.setTimeout(() => dropOlder(key, true), 60_000);
    return () => window.clearTimeout(t);
  }, [key, chat?.visible]);
  // The demo's long chat (?long=5000), for measuring.
  useEffect(() => {
    if (chat && isMock()) seedLongChat(chat.box, chat.session);
  }, [chat?.box, chat?.session]);
  // A rewound prompt stays hidden until the agent's record no longer has it.
  useEffect(() => {
    if (chat && cut && !live.some((it) => meta(it).uuid === cut)) setCut(chat.box, chat.session, undefined);
  }, [chat, cut, live]);
  // Older turns end where the live ones begin: one read afresh may reach
  // back over some of them. Worked out again only when the older turns or
  // where the live ones start change, not as the live ones grow.
  const from = live.find((it) => meta(it).off !== undefined);
  const at = from ? meta(from).off! : Infinity;
  const olderAll = useMemo(() => (history ? older.items.filter((it) => (meta(it).off ?? 0) < at) : []), [history, older.items, at]);
  const before = useMemo(() => {
    if (!olderAll.length) return olderAll;
    // An item can't be both (a live one starts at or after at), but a
    // window read afresh may give one without its place.
    const loose = live.filter((it) => meta(it).off === undefined);
    if (!loose.length) return olderAll;
    const ids = new Set(loose.map((it) => it.id));
    return olderAll.filter((it) => !ids.has(it.id));
  }, [olderAll, live]);
  const items = useMemo(() => (history ? [...before, ...applyCut(live, cut)] : live), [history, before, live, cut]);
  const turns = useTurns(items, readOnly);
  const last = items[items.length - 1];
  const grew = last?.kind === "text" ? last.text.length : last?.kind === "tools" ? (last.items?.length ?? 0) : 0;
  // A prompt or command sent brings the view back to the foot.
  const sent = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) if (items[i].kind === "user" || items[i].kind === "command") return items[i].id;
  }, [items]);
  const oldest = items.length ? meta(items[0]).off : undefined;
  const nearTop = history && oldest ? () => void loadOlder(chat!.box, chat!.session, oldest) : undefined;
  // Shown again after its older turns went: they come back as they were.
  useEffect(() => {
    if (history && chat && chat.visible !== false && older.depth !== undefined) restoreOlder(chat.box, chat.session, oldest);
  }, [history, chat?.box, chat?.session, chat?.visible, older.depth, older.loading, oldest]);
  const [reveal, setReveal] = useState<string[]>([]);
  const revealed = useMemo(() => new Set(reveal), [reveal]);
  // What ⌘F looks through, worked out only while it is open.
  const entries = useCallback(() => transcriptSearchEntries(turns, searchable), [turns]);
  const itemsNow = useRef(items);
  itemsNow.current = items;
  const ctx = useMemo<PromptContext | null>(
    () => (chat ? { box: chat.box, session: chat.session, claude: history && chat.agent === "claude", idle: chat.idle ?? true, who, items: () => itemsNow.current } : null),
    [chat?.box, chat?.session, chat?.agent, chat?.idle, history, who],
  );
  const header =
    history && oldest && (older.loading || older.error || older.items.length || !older.more || live.length >= 250) ? (
      <OlderHeader older={older} onLoad={() => nearTop?.()} />
    ) : undefined;

  return (
    <TranscriptRuntime turns={turns} who={who} onAnswer={onAnswer} edits={edits} readOnly={readOnly}>
      <RevealContext.Provider value={revealed}>
        <PromptActionsContext.Provider value={ctx}>
          <RuntimeList
            className={cn("mx-auto w-full max-w-(--berth-chat-w) text-[0.875rem] text-foreground leading-relaxed", className)}
            turns={turns}
            header={header}
            tail={tail}
            grew={`${grew}:${tailSize}`}
            repin={sent}
            onNearTop={nearTop}
          >
            {chat
              ? (api) => (
                  <>
                    <ChatSearch api={api} entries={entries} onReveal={setReveal} />
                    <ArtifactJumper api={api} chat={key} rows={turns} older={history ? older : undefined} onLoadOlder={nearTop} />
                    <TurnSync api={api} rows={turns} isTurn={isTurn} />
                    <SelectionActions api={api} chat={key} who={who} />
                  </>
                )
              : undefined}
          </RuntimeList>
          {chat && <HelperSheetHost />}
        </PromptActionsContext.Provider>
      </RevealContext.Provider>
    </TranscriptRuntime>
  );
}

// An item's words, once per item: it is the same object until it changes.
const words = new WeakMap<TranscriptItem, string>();
function searchable(it: TranscriptItem): string {
  let w = words.get(it);
  if (w === undefined) words.set(it, (w = wordsOf(it)));
  return w;
}

function wordsOf(it: TranscriptItem): string {
  switch (it.kind) {
    case "user":
      return withoutReminders(it.text);
    case "text":
      return plainMarkdown(it.text);
    case "tools":
      return [toolSummary(it), ...(it.items ?? []).map((c) => `${c.verb}\n${c.target}`)].join("\n");
    case "edit":
      return `Edited ${it.file}`;
    case "crew":
      return it.names.join("\n");
    case "command":
      return [it.command, it.args, it.text].filter(Boolean).join("\n");
    case "notice":
      return it.text;
    case "ask":
      return it.detail;
    case "artifact":
      return [it.text, it.description].filter(Boolean).join("\n");
    case "question":
      return it.questions.map((q, i) => [q.question, it.answers?.[i]].filter(Boolean).join("\n")).join("\n");
    case "report":
      return [`${reportName(it.report)} ${reportWord(it.report)}`, it.report.answer, it.report.needs].filter(Boolean).join("\n");
    case "agent-message":
      return messageText(it.msg);
    case "ping":
      return it.msg.summary ?? "";
  }
  return "";
}

// OlderHeader is the top of a long chat: earlier turns loading, a way to
// load them, or where the conversation began.
function OlderHeader({ older, onLoad }: { older: { loading: boolean; error?: string; more: boolean }; onLoad(): void }) {
  return (
    <div className="flex h-10 items-center justify-center pb-4 text-muted-foreground text-xs">
      {older.loading ? (
        <PixelLoader label="Loading earlier messages…" />
      ) : older.error ? (
        <span className="flex items-center gap-2">
          <span className="text-destructive-foreground">Couldn't load earlier messages.</span>
          <Button size="xs" variant="ghost" onClick={onLoad}>
            <RotateCwIcon />
            Retry
          </Button>
        </span>
      ) : older.more ? (
        <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={onLoad}>
          <ClockIcon />
          Load earlier messages
        </Button>
      ) : (
        <span className="flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          Start of the conversation
          <span className="h-px flex-1 bg-border" />
        </span>
      )}
    </div>
  );
}
