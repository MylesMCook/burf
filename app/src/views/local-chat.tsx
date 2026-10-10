import { useCallback, useEffect, useMemo, useState } from "react";
import { Chat } from "@/components/chat/chat";
import type { Client } from "@/lib/api";
import { localApi, localAgentName, type LocalSession, type LocalHistoryPage, type ChatOptions, type ChatDecision } from "@/lib/local-computer";
import { savedChatMessages } from "@/lib/saved-chat";
import { errorMessage } from "@/lib/format";

export function LocalChat({ client, session, onChange }: { client: Client; session: LocalSession; onChange(session: LocalSession): void }) {
  const [history, setHistory] = useState<LocalHistoryPage>();
  const [error, setError] = useState("");
  const loadHistory = useCallback(async (before?: number, signal?: AbortSignal) => {
    if (!session.history_id) return;
    try {
      const page = await localApi.history(client, session.history_id, before ?? session.history_before, signal);
      if (signal?.aborted) return;
      setHistory((old) => {
        const ids = new Set(page.items.map((item) => item.id));
        return { ...page, items: before === undefined ? page.items : [...page.items, ...(old?.items ?? []).filter((item) => !ids.has(item.id))].slice(0, 5000) };
      });
      setError("");
    } catch (e) { if (!signal?.aborted) setError(errorMessage(e)); }
  }, [client, session.history_id, session.history_before]);
  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(undefined, controller.signal);
    return () => controller.abort();
  }, [loadHistory]);
  const prefixMessages = useMemo(() => savedChatMessages(history?.items ?? []).map((message) => ({ ...message, id: `history:${session.history_id}:${message.id}` })), [history, session.history_id]);
  const before = history?.start ?? history?.items[0]?.off;
  const transport = useMemo(() => ({
    prefixMessages, hasEarlier: !!history?.more && before !== undefined,
    loadEarlier: async () => { if (before !== undefined) await loadHistory(before); },
    session, agentName: localAgentName(session.agent), testId: "local-chat", onChange: (value: { state: LocalSession["state"] }) => onChange({ ...session, state: value.state }),
    read: (signal?: AbortSignal) => localApi.chat(client, session.id, signal),
    message: (text: string, options?: ChatOptions) => localApi.message(client, session.id, text, options),
    models: () => localApi.models(client, session.id),
    stop: () => localApi.stopChat(client, session.id),
    interrupt: () => localApi.interruptChat(client, session.id),
    approve: (id: string, decision: ChatDecision) => localApi.approveChat(client, session.id, id, decision),
  }), [client, session, onChange, prefixMessages, history?.more, before, loadHistory]);
  return <>{error && <p role="alert">Saved context could not be loaded: {error}</p>}<Chat transport={transport} /></>;
}
