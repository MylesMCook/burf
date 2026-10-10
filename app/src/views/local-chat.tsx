import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Chat } from "@/components/chat/chat";
import type { Client } from "@/lib/api";
import { localApi, localAgentName, type LocalSession, type LocalHistoryPage, type ChatOptions, type ChatDecision } from "@/lib/local-computer";
import { savedChatMessages } from "@/lib/saved-chat";
import { errorMessage } from "@/lib/format";
import { useChatPaneFocus } from "@/lib/focus-home";
import { changeLocalChatDraft, localChatDraft } from "@/lib/workspaces";
import { localChatDraftKey, recoveredLocalChatDraft, settleLocalChatDraft } from "@/lib/local-chat-draft";

const layout = stylex.create({ root: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } });
const fallbackScopes = new WeakMap<Client, string>();
type LocalChatProps = { client: Client; session: LocalSession; accountScope?: string; onChange(session: LocalSession): void };

export function LocalChat(props: LocalChatProps) {
  let account = props.accountScope ?? fallbackScopes.get(props.client);
  if (!account) { account = crypto.randomUUID(); fallbackScopes.set(props.client, account); }
  // Older clients can preserve navigation state, but cannot identify an account
  // across app launches. Never substitute a shared persistent fallback for it.
  return <LocalChatSession key={localChatDraftKey({ ...props.session, account })} {...props} accountScope={account} />;
}

function LocalChatSession({ client, session, onChange, accountScope }: LocalChatProps & { accountScope: string }) {
  const scope = useMemo(() => ({ ...session, account: accountScope }), [session, accountScope]);
  const root = useRef<HTMLDivElement>(null);
  useChatPaneFocus(root, true);
  const [saved] = useState(() => { const draft = localChatDraft(scope); return { ...recoveredLocalChatDraft(draft), uncertain: !!draft.pending, recoveredRequest: draft.pending?.id }; });
  // Recover once. Reopening again must not prepend the same uncertain text.
  useLayoutEffect(() => {
    if (saved.recoveredRequest) changeLocalChatDraft(scope, (draft) => draft.pending?.id === saved.recoveredRequest ? recoveredLocalChatDraft(draft) : draft);
  }, [saved, scope]);
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
    initialDraft: saved.text, initialOptions: saved.options,
    initialQueue: saved.queue, initialQueueHeld: !!saved.held || !!saved.queue.length,
    initialSendError: saved.uncertain ? "A previous send may have arrived. Refresh the chat and check before sending it again. Queued messages are held." : undefined,
    onDraftChange: (text: string) => changeLocalChatDraft(scope, (draft) => ({ ...draft, text })),
    onOptionsChange: (options: ChatOptions) => changeLocalChatDraft(scope, (draft) => ({ ...draft, options })),
    onQueueChange: (queue: typeof saved.queue, held: boolean) => changeLocalChatDraft(scope, (draft) => ({ ...draft, queue, held })),
    onSendStart: (text: string, options: ChatOptions) => {
      const id = crypto.randomUUID();
      changeLocalChatDraft(scope, (draft) => ({ ...draft, text: "", pending: { id, text, options } }));
      return id;
    },
    onSendSettled: (request: string, sent: boolean) => changeLocalChatDraft(scope, (draft) => settleLocalChatDraft(draft, request, sent)),
    prefixMessages, hasEarlier: !!history?.more && before !== undefined,
    loadEarlier: async () => { if (before !== undefined) await loadHistory(before); },
    session, agentName: localAgentName(session.agent), testId: "local-chat", onChange: (value: { state: LocalSession["state"] }) => onChange({ ...session, state: value.state }),
    read: async (signal?: AbortSignal) => {
      const current = await localApi.chat(client, session.id, signal);
      if (current.id !== session.id || current.cwd !== session.cwd || current.agent !== session.agent || current.started_at !== session.started_at) throw new Error("This local chat changed. Refresh This computer before continuing.");
      return current;
    },
    message: (text: string, options?: ChatOptions) => localApi.message(client, session.id, text, options),
    models: () => localApi.models(client, session.id),
    stop: () => localApi.stopChat(client, session.id),
    interrupt: () => localApi.interruptChat(client, session.id),
    approve: (id: string, decision: ChatDecision) => localApi.approveChat(client, session.id, id, decision),
  }), [client, session, scope, saved, onChange, prefixMessages, history?.more, before, loadHistory]);
  return <div ref={root} {...stylex.props(layout.root)}>{error && <p role="alert">Saved context could not be loaded: {error}</p>}<Chat key={session.id} transport={transport} /></div>;
}
