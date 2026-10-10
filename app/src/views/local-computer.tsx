import { GitForkIcon, PlusIcon, RotateCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chat } from "@/components/chat/chat";
import type { ChatTransport } from "@/components/chat/chat-transport";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import { type Client } from "@/lib/api";
import { openComposer } from "@/lib/composer";
import { errorMessage } from "@/lib/format";
import { noteLocalSession, refreshLocalDesk, useLocalDesk } from "@/lib/local-desk";
import { localAgentName, localApi, type LocalConversation, type LocalHistoryPage, type LocalSession } from "@/lib/local-computer";
import { useStore } from "@/lib/store";
import { savedChatMessages } from "@/lib/saved-chat";
import { cn } from "@/lib/utils";
import { ViewHeader } from "@/views/view-header";
import { LocalTerminal } from "@/views/local-terminal";
import { LocalChat } from "@/views/local-chat";

const EMPTY: LocalHistoryPage["items"] = [];

export function LocalComputerView() {
  const client = useStore((s) => s.client)!;
  const desk = useLocalDesk();
  const local = desk.computer;
  const view = useStore((s) => s.view);
  const opened = view.kind === "local" ? view.session : undefined;
  useEffect(() => { void refreshLocalDesk(); }, [client]);
  useEffect(() => {
    if (!opened) return;
    noteLocalSession(opened);
    useLocalDesk.setState({ pick: { kind: "session", id: opened.id } });
  }, [opened]);
  const pick = desk.pick;
  const session = pick?.kind === "session" ? (local?.sessions.find((s) => s.id === pick.id) ?? (opened?.id === pick.id ? opened : undefined)) : undefined;
  const conversation = pick?.kind === "history" ? desk.conversations.find((c) => c.id === pick.id) : undefined;

  return <div className="flex h-full min-w-0 flex-col">
    <ViewHeader title={local?.name || "This computer"} description="This computer" actions={<>
      <Tip label="Refresh local conversations"><Button size="icon-sm" variant="ghost" aria-label="Refresh local conversations" disabled={desk.loading} onClick={() => void refreshLocalDesk()}><RotateCwIcon className={cn("size-4", desk.loading && "animate-spin")} /></Button></Tip>
      <Button size="sm" disabled={!local?.supported} onClick={() => { useLocalDesk.setState({ pick: undefined }); openComposer({ place: { kind: "local" } }); }}><PlusIcon />New agent</Button>
    </>} />
    {desk.error && <div role="alert" className="border-b px-4 py-2 text-sm text-destructive">{desk.error}</div>}
    {local && !local.supported ? <p className="p-6 text-sm text-muted-foreground">Local agents are unavailable on this computer.</p> : <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {conversation && <LocalHistory key={conversation.id} client={client} conversation={conversation} canFork={!!local?.agents.find((a) => a.id === conversation.source)?.can_fork} onStart={(next) => {
          noteLocalSession(next);
          useLocalDesk.setState({ pick: { kind: "session", id: next.id } });
          useStore.getState().setView({ kind: "local", session: next });
        }} />}
        {session && (session.mode === "chat" ? <LocalChat key={session.id} client={client} session={session} onChange={noteLocalSession} /> : <LocalTerminal key={session.id} client={client} session={session} onChange={noteLocalSession} />)}
        {!conversation && !session && <div className="m-auto px-6 text-sm text-muted-foreground">Select a conversation or start an agent.</div>}
      </section>}
  </div>;
}

function LocalHistory({ client, conversation, canFork, onStart }: { client: Client; conversation: LocalConversation; canFork: boolean; onStart(session: LocalSession): void }) {
  const [page, setPage] = useState<LocalHistoryPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const startingRef = useRef(false);
  const launch = useRef<AbortController | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (before?: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await localApi.history(client, conversation.id, before, controller.signal);
      if (controller.signal.aborted) return;
      setPage((old) => {
        const items = result.items ?? [];
        const ids = new Set(items.map((it) => it.id));
        return { ...result, items: before === undefined ? items : [...items, ...(old?.items ?? []).filter((it) => !ids.has(it.id))].slice(0, 5000) };
      });
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [client, conversation.id]);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  useEffect(() => () => launch.current?.abort(), [client, conversation.id]);
  const before = page?.start ?? page?.items[0]?.off;
  const usable = conversation.can_continue !== false;
  const canContinue = canFork && usable;
  const continueReason = usable ? undefined : conversation.continue_reason;
  const messages = useMemo(() => savedChatMessages(page?.items ?? EMPTY), [page?.items]);
  const transport = useMemo<ChatTransport>(() => {
    const session = { id: conversation.id, agent: conversation.source, cwd: conversation.cwd, state: "idle" as const, started_at: conversation.updated_at };
    const snapshot = { ...session, thread_id: conversation.id, items: [], approvals: [], messages };
    return {
      session, snapshot, agentName: localAgentName(conversation.source), testId: "local-history", readOnly: true,
      loading: loading && !page, hasEarlier: !!page?.more && before !== undefined,
      loadEarlier: async () => { if (!loading && before !== undefined) await load(before); },
      read: async () => snapshot,
    };
  }, [conversation, messages, loading, page, before, load]);
  return <>
    <div className="flex min-w-0 flex-wrap items-center gap-3 border-b px-4 py-3"><h2 className="min-w-0 flex-1 truncate text-sm font-medium" title={conversation.title}>{conversation.title}</h2><span className="shrink-0 text-xs text-muted-foreground">Read-only</span></div>
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      <Tip label={canFork ? "Continue as a new chat; the original stays unchanged" : "Installed CLI does not support continuing a copy"}>
        <Button size="sm" variant="outline" disabled={!canContinue || starting} aria-describedby={continueReason ? "local-continue-reason" : undefined} onClick={async () => {
          if (!canContinue || startingRef.current) return;
          startingRef.current = true;
          const controller = new AbortController();
          launch.current = controller;
          setStarting(true); setStartError("");
          try {
            const session = await localApi.fork(client, conversation.id, controller.signal);
            if (!controller.signal.aborted) onStart(session);
          }
          catch (e) { if (!controller.signal.aborted) setStartError(errorMessage(e)); }
          finally { startingRef.current = false; setStarting(false); }
        }}><GitForkIcon />{starting ? "Starting..." : "Continue in Burf"}</Button>
      </Tip>
      {continueReason && <p id="local-continue-reason" role="status" className="text-xs text-muted-foreground">{continueReason}</p>}
      <Tip label="Refresh conversation"><Button size="icon-sm" variant="ghost" aria-label="Refresh conversation" disabled={loading} onClick={() => void load()}><RotateCwIcon className="size-4" /></Button></Tip>
      {loading && <span role="status" className="text-xs text-muted-foreground">Loading conversation...</span>}
    </div>
    {error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{error}</p>}
    {startError && <p role="alert" className="px-4 py-2 text-sm text-destructive">{startError}</p>}
    <Chat transport={transport} />
  </>;
}
