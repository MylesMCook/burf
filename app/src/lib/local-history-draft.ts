import { emptyLocalChatDraft, recoveredLocalChatDraft, type LocalChatDraft, type LocalChatScope } from "./local-chat-draft.ts";
import type { LocalSession } from "./local-computer.ts";

type History = { id: string; source: string; cwd: string };

export function localHistoryDraftScope(account: string, history: History): LocalChatScope {
  return { account, id: `history:${history.id}`, agent: history.source, cwd: history.cwd, started_at: "saved-history" };
}

export function matchingLocalHistoryChats(history: History, sessions: readonly LocalSession[]) {
  return sessions.filter((session) => session.mode === "chat" && session.state !== "exited" && session.history_id === history.id && session.agent === history.source && session.cwd === history.cwd);
}

// A first Send moves its journal before delivery. Recovery moves held text only;
// an earlier uncertain send on the existing continuation always wins.
export function transferLocalHistoryDraft(source: LocalChatDraft, target: LocalChatDraft, sendPending: boolean): { source: LocalChatDraft; target: LocalChatDraft; send: boolean } {
  const pending = sendPending && !target.pending ? source.pending : undefined;
  const following = pending ? { ...source, pending: undefined } : recoveredLocalChatDraft(source);
  return {
    source: sendPending && source.launch ? { ...emptyLocalChatDraft(), launch: source.launch } : emptyLocalChatDraft(),
    target: {
      ...target,
      text: [target.text, following.text].filter(Boolean).join("\n\n"),
      options: target.text || target.pending ? target.options : following.options,
      queue: [...target.queue, ...following.queue],
      pending: pending ?? target.pending,
      held: true,
    },
    send: !!pending,
  };
}
