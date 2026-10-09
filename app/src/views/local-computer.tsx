import { GitForkIcon, RotateCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chat } from "@/components/chat/chat";
import type { ChatTransport } from "@/components/chat/chat-transport";
import { TaskComposer } from "@/components/conversation/task-composer";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import type { Client } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { localAgentName, localApi, type LocalComputer, type LocalConversation, type LocalHistoryPage, type LocalSession } from "@/lib/local-computer";
import { useLocalComputerRefresh } from "@/lib/local-computer-refresh";
import { useStore } from "@/lib/store";
import { savedChatMessages } from "@/lib/saved-chat";
import { cn } from "@/lib/utils";
import { ViewHeader } from "@/views/view-header";
import { LocalTerminal } from "@/views/local-terminal";
import { LocalChat } from "@/views/local-chat";

const EMPTY: LocalHistoryPage["items"] = [];

export function LocalComputerView() {
  const client = useStore((s) => s.client)!;
  const view = useStore((s) => s.view);
  const openedSession = view.kind === "local" ? view.session : undefined;
  const openedHistory = view.kind === "local" ? view.history : undefined;
  const [local, setLocal] = useState<LocalComputer>();
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const value = await localApi.status(client, controller.signal);
      if (controller.signal.aborted) return;
      setLocal(value);
      const history = value.supported ? await localApi.conversations(client, controller.signal) : [];
      if (controller.signal.aborted) return;
      setConversations(history ?? []);
      useLocalComputerRefresh.getState().bump();
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);

  const changeSession = useCallback((session: LocalSession) => {
    setLocal((value) => (value ? { ...value, sessions: [session, ...(value.sessions ?? []).filter((s) => s.id !== session.id)] } : value));
    const current = useStore.getState().view;
    if (current.kind === "local" && current.session?.id === session.id) {
      useStore.getState().setView({ kind: "local", session });
    }
  }, []);

  useEffect(() => {
    if (!openedSession) return;
    setLocal((value) =>
      value
        ? { ...value, sessions: [openedSession, ...(value.sessions ?? []).filter((s) => s.id !== openedSession.id)] }
        : value,
    );
  }, [openedSession]);

  const openNew = useCallback(() => {
    useStore.getState().setView({ kind: "local" });
  }, []);

  const selection = openedSession
    ? ({ kind: "session" as const, session: openedSession })
    : openedHistory
      ? ({ kind: "history" as const, conversation: openedHistory })
      : undefined;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ViewHeader
        title={local?.name || "This computer"}
        actions={
          <>
            <Tip label="Refresh local conversations">
              <Button size="icon-sm" variant="ghost" aria-label="Refresh local conversations" disabled={loading} onClick={() => void refresh()}>
                <RotateCwIcon className={cn("size-4", loading && "animate-spin")} />
              </Button>
            </Tip>
            <Button size="sm" disabled={!local?.supported} onClick={openNew}>
              New agent
            </Button>
          </>
        }
      />
      {error && (
        <div role="alert" className="border-b px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {local && !local.supported ? (
        <p className="p-6 text-sm text-muted-foreground">Local agents are unavailable on this computer.</p>
      ) : (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selection?.kind === "history" && (
            <LocalHistory
              key={selection.conversation.id}
              client={client}
              conversation={conversations.find((c) => c.id === selection.conversation.id) ?? selection.conversation}
              canChat={!!local?.agents.find((a) => a.id === selection.conversation.source)?.can_chat}
              onStart={(session) => {
                changeSession(session);
                useStore.getState().setView({ kind: "local", session });
              }}
            />
          )}
          {selection?.kind === "session" &&
            (selection.session.mode === "chat" ? (
              <LocalChat key={selection.session.id} client={client} session={selection.session} onChange={changeSession} />
            ) : (
              <LocalTerminal key={selection.session.id} client={client} session={selection.session} onChange={changeSession} />
            ))}
          {!selection && (
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8">
              <TaskComposer draft={{ place: { kind: "local" }, mode: "start" }} autoFocus className="w-full" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function LocalHistory({
  client,
  conversation,
  canChat,
  onStart,
}: {
  client: Client;
  conversation: LocalConversation;
  canChat: boolean;
  onStart(session: LocalSession, conversationID: string): void;
}) {
  const [page, setPage] = useState<LocalHistoryPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const startingRef = useRef(false);
  const launch = useRef<AbortController | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(
    async (before?: number) => {
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
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [client, conversation.id],
  );
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  useEffect(() => () => launch.current?.abort(), [client, conversation.id]);
  const before = page?.start ?? page?.items[0]?.off;
  const usable = conversation.can_continue !== false;
  const canContinue = canChat && usable;
  const continueReason = usable ? undefined : conversation.continue_reason;
  const messages = useMemo(() => savedChatMessages(page?.items ?? EMPTY), [page?.items]);
  const transport = useMemo<ChatTransport>(() => {
    const session = { id: conversation.id, agent: conversation.source, cwd: conversation.cwd, state: "idle" as const, started_at: conversation.updated_at, title: conversation.title };
    const snapshot = { ...session, thread_id: conversation.id, items: [], approvals: [], messages };
    return {
      session,
      snapshot,
      agentName: localAgentName(conversation.source),
      testId: "local-history",
      readOnly: true,
      loading: loading && !page,
      hasEarlier: !!page?.more && before !== undefined,
      loadEarlier: async () => {
        if (!loading && before !== undefined) await load(before);
      },
      read: async () => snapshot,
    };
  }, [conversation, messages, loading, page, before, load]);
  const title = conversation.title?.trim() || "Untitled";
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-3 border-b px-4 py-3">
        <Tip label={conversation.cwd}>
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h2>
        </Tip>
        <span className="shrink-0 text-xs text-muted-foreground">Read-only</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Tip label={canChat ? "Branch this conversation into a chat. The saved copy stays unchanged." : "Installed CLI does not support a structured chat"}>
          <Button
            size="sm"
            variant="outline"
            disabled={!canContinue || starting}
            aria-label={starting ? "Starting..." : "Continue in Burf"}
            aria-describedby={continueReason ? "local-continue-reason" : undefined}
            onClick={async () => {
              if (!canContinue || startingRef.current) return;
              startingRef.current = true;
              const controller = new AbortController();
              launch.current = controller;
              setStarting(true);
              setStartError("");
              try {
                const session = await localApi.continueChat(client, conversation.id, controller.signal);
                if (!controller.signal.aborted) onStart(session, conversation.id);
              } catch (e) {
                if (controller.signal.aborted) return;
                setStartError(errorMessage(e));
              } finally {
                startingRef.current = false;
                setStarting(false);
              }
            }}
          >
            <GitForkIcon />
            {starting ? "Starting..." : "Continue in Burf"}
          </Button>
        </Tip>
        {continueReason && (
          <p id="local-continue-reason" role="status" className="text-xs text-muted-foreground">
            {continueReason}
          </p>
        )}
        <Tip label="Refresh conversation">
          <Button size="icon-sm" variant="ghost" aria-label="Refresh conversation" disabled={loading} onClick={() => void load()}>
            <RotateCwIcon className="size-4" />
          </Button>
        </Tip>
        {loading && (
          <span role="status" className="text-xs text-muted-foreground">
            Loading conversation...
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {startError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {startError}
        </p>
      )}
      <Chat transport={transport} />
    </>
  );
}
