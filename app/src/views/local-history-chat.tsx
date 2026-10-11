import * as stylex from "@stylexjs/stylex";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Chat } from "@/components/chat/chat";
import type { ChatTransport } from "@/components/chat/chat-transport";
import { Button } from "@/components/ui/button";
import { ApiError, type Client } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useChatPaneFocus } from "@/lib/focus-home";
import { localApi, localAgentName, type LocalConversation, type LocalSession } from "@/lib/local-computer";
import { localChatDraftKey, recoveredLocalChatDraft, settleLocalChatDraft } from "@/lib/local-chat-draft";
import { localHistoryDraftScope, matchingLocalHistoryChats } from "@/lib/local-history-draft";
import { changeLocalChatDraft, changeLocalChatDraftChecked, localChatDraft, moveLocalHistoryDraft } from "@/lib/workspaces";
import { StorageWriteError } from "@/lib/storage";
import { localChatAccountScope } from "@/lib/local-chat-scope";

const layout = stylex.create({
  root: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 },
  note: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--muted-foreground)", paddingTop: 8, paddingBottom: 8 },
});
const uncertainLaunch = "A continuation may have started. Find the started chat before sending again. Your draft is held; nothing will be sent automatically.";

type Props = { client: Client; conversation: LocalConversation; accountScope?: string; messages: readonly ThreadMessageLike[]; loading: boolean; hasEarlier: boolean; loadEarlier(): Promise<void>; onStart(session: LocalSession, conversationID: string): void };

export function LocalHistoryChat(props: Props) {
  const account = localChatAccountScope(props.client, props.accountScope);
  const scope = localHistoryDraftScope(account, props.conversation);
  return <HistoryContinuation key={localChatDraftKey(scope)} {...props} accountScope={account} />;
}

function HistoryContinuation({ client, conversation, accountScope, messages, loading, hasEarlier, loadEarlier, onStart }: Props & { accountScope: string }) {
  const scope = useMemo(() => localHistoryDraftScope(accountScope, conversation), [accountScope, conversation.id, conversation.source, conversation.cwd]);
  const [saved] = useState(() => { const draft = localChatDraft(scope); return { ...recoveredLocalChatDraft(draft), recoveredRequest: draft.pending?.id }; });
  const [held, setHeld] = useState(!!saved.launch);
  const heldRef = useRef(held);
  const [finding, setFinding] = useState(false);
  const findingRef = useRef(false);
  const [recoveryError, setRecoveryError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useChatPaneFocus(root, true);
  const alive = useRef(true);
  const launch = useRef<AbortController | undefined>(undefined);
  const bound = useRef<LocalSession | undefined>(undefined);
  const moved = useRef(false);
  const finished = useRef(false);
  const definiteRejection = useRef(false);
  const sendError = useRef("");
  const draftWriteFailed = useRef(false);
  const latestText = useRef(saved.text);
  useLayoutEffect(() => {
    // Consume the old journal before the stock composer saves recovered text.
    if (saved.recoveredRequest) changeLocalChatDraft(scope, (draft) => draft.pending?.id === saved.recoveredRequest ? recoveredLocalChatDraft(draft) : draft);
  }, [scope, saved]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; launch.current?.abort(); };
  }, [scope]);

  const validate = (session: LocalSession) => {
    if (typeof session.id !== "string" || !session.id || typeof session.started_at !== "string" || !session.started_at || session.mode !== "chat" || session.state === "exited" || session.agent !== conversation.source || session.cwd !== conversation.cwd || session.history_id !== conversation.id) throw new Error("This continuation changed. Refresh This computer and check the started chat before sending.");
    return session;
  };
  const confirm = async (session: LocalSession, signal?: AbortSignal) => {
    validate(session);
    const current = await localApi.chat(client, session.id, signal);
    validate(current);
    if (current.id !== session.id || current.started_at !== session.started_at) throw new Error("This local chat changed. Refresh This computer before continuing.");
    return current;
  };
  const recover = async () => {
    if (findingRef.current) return;
    findingRef.current = true;
    setFinding(true); setRecoveryError("");
    const controller = new AbortController(); launch.current = controller;
    try {
      const status = await localApi.status(client, controller.signal);
      if (status.client_scope && status.client_scope !== accountScope) throw new Error("This computer account changed. Reopen the conversation before recovering its draft.");
      const matches = matchingLocalHistoryChats(conversation, status.sessions ?? []);
      if (matches.length !== 1) throw new Error(matches.length ? "More than one matching chat was found. Open Started in Burf and check which chat to use. Your draft stays here." : "No matching chat was found. Refresh This computer and check Started in Burf. Your draft stays here; Send will not launch another chat.");
      const session = matches[0];
      await confirm(session, controller.signal);
      if (controller.signal.aborted || !alive.current) return;
      const target = { ...session, account: accountScope };
      moveLocalHistoryDraft(scope, target, false, {
        sourceText: draftWriteFailed.current && !moved.current ? latestText.current : undefined,
        changeTarget: (draft) => ({ ...draft, held: true, sendError: "Recovered the independent chat. Check its messages and review your held draft before sending; nothing was resent automatically." }),
      });
      finished.current = true;
      onStart(session, conversation.id);
    } catch (error) { if (alive.current && !controller.signal.aborted) setRecoveryError(errorMessage(error)); }
    finally { findingRef.current = false; if (alive.current) setFinding(false); }
  };

  const transport = useMemo<ChatTransport>(() => {
    const session = { id: `history:${conversation.id}`, agent: conversation.source, cwd: conversation.cwd, state: "idle" as const, started_at: "saved-history" };
    const snapshot = { ...session, thread_id: conversation.id, items: [], approvals: [], messages };
    return {
      session, snapshot, agentName: localAgentName(conversation.source), testId: "local-history",
      initialDraft: saved.text, initialOptions: saved.options, initialSendError: saved.launch ? uncertainLaunch : saved.sendError,
      inputLabel: `Message ${localAgentName(conversation.source)}`, placeholder: "Continue this conversation...",
      sendDisabled: held || loading,
      optionsReason: "Send your first message to start this continuation. Chat settings are available afterward.",
      loading, hasEarlier, loadEarlier, read: async () => snapshot,
      onDraftChange: (text) => { latestText.current = text; if (!finished.current && !(draftWriteFailed.current && !moved.current)) changeLocalChatDraft(scope, (draft) => ({ ...draft, text })); },
      onOptionsChange: (options) => { if (!finished.current && !draftWriteFailed.current) changeLocalChatDraft(scope, (draft) => ({ ...draft, options })); },
      onSendStart: (text, options) => {
        const id = crypto.randomUUID();
        definiteRejection.current = false; moved.current = false; bound.current = undefined; sendError.current = ""; draftWriteFailed.current = false;
        changeLocalChatDraftChecked(scope, (draft) => ({ ...draft, text: "", launch: id, sendError: undefined, pending: { id, text, options } }));
        return id;
      },
      message: async (text, options) => {
        if (heldRef.current) throw new Error(uncertainLaunch);
        const controller = new AbortController(); launch.current = controller;
        try {
          const session = validate(await localApi.continueChat(client, conversation.id, controller.signal));
          bound.current = session;
          const current = await confirm(session, controller.signal);
          if (controller.signal.aborted || !alive.current) throw new Error(uncertainLaunch);
          const target = { ...session, account: accountScope };
          const send = moveLocalHistoryDraft(scope, target, true);
          moved.current = true;
          if (!send) throw new Error("A previous send on this continuation may have arrived. Check the chat before sending the held draft again.");
          await localApi.message(client, session.id, text, current.composer ? options : undefined);
        } catch (error) {
          sendError.current = errorMessage(error);
          draftWriteFailed.current = error instanceof StorageWriteError;
          definiteRejection.current = !bound.current && error instanceof ApiError && (error.status >= 400 && error.status < 500 && error.status !== 408 || error.code === "agent_restarting");
          throw error;
        }
      },
      onSendSettled: (request, sent) => {
        if (draftWriteFailed.current && !moved.current) {
          // The source journal remains intact when its target could not be saved.
          latestText.current = recoveredLocalChatDraft(localChatDraft(scope)).text;
          heldRef.current = true;
          if (alive.current) { setHeld(true); setRecoveryError(sendError.current + " The continuation started, but your message was not sent. Restore storage, then choose Find started chat."); }
          return;
        }
        if (bound.current && moved.current) {
          const session = bound.current;
          const target = { ...session, account: accountScope };
          try {
            moveLocalHistoryDraft(scope, target, false, {
              changeTarget: (draft) => draft.pending?.id === request ? { ...settleLocalChatDraft(draft, request, sent), sendError: sent ? undefined : sendError.current } : { ...draft, sendError: sendError.current || draft.sendError },
            });
            finished.current = true;
            if (alive.current) onStart(session, conversation.id);
          } catch (error) {
            draftWriteFailed.current = error instanceof StorageWriteError;
            heldRef.current = true;
            if (alive.current) { setHeld(true); setRecoveryError(errorMessage(error) + " Check the started chat before sending anything again."); }
          }
        } else {
          const uncertain = !definiteRejection.current;
          heldRef.current = uncertain;
          changeLocalChatDraft(scope, (draft) => ({ ...settleLocalChatDraft(draft, request, false), launch: uncertain ? request : undefined, sendError: uncertain ? uncertainLaunch : sendError.current, held: uncertain }));
          if (alive.current) setHeld(uncertain);
        }
      },
    };
  }, [client, conversation, scope, accountScope, messages, loading, hasEarlier, loadEarlier, saved, held, onStart]);

  return <div ref={root} {...stylex.props(layout.root)}><Chat transport={transport} beforeComposer={<section aria-label="Continue this conversation" {...stylex.props(layout.note)}>
    <p>{held ? uncertainLaunch : "Sending starts an independent chat with this history. The saved conversation stays unchanged."}</p>
    {held && <Button size="sm" variant="outline" disabled={finding} onClick={() => void recover()}>{finding ? "Finding chat..." : "Find started chat"}</Button>}
    {recoveryError && <p role="alert">{recoveryError}</p>}
  </section>} /></div>;
}
