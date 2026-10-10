import type { SavedQueueMessage } from "./chat-queue.ts";

export interface LocalChatScope { account: string; id: string; agent: string; cwd: string; started_at: string }
export interface LocalChatDraft {
  text: string;
  options: SavedQueueMessage["options"];
  queue: SavedQueueMessage[];
  held?: boolean;
  pending?: SavedQueueMessage & { id: string };
}

// A provider's session ID alone is not a laptop or account identity. Require
// all of the authenticated local session's immutable identity fields.
export const localChatDraftKey = (session: LocalChatScope) => JSON.stringify([session.account, session.id, session.agent, session.cwd, session.started_at]);
export const emptyLocalChatDraft = (): LocalChatDraft => ({ text: "", options: {}, queue: [] });

export function readLocalChatDraft(value: unknown): LocalChatDraft {
  if (!value || typeof value !== "object") return emptyLocalChatDraft();
  const record = value as Record<string, unknown>;
  const options = (value: unknown): SavedQueueMessage["options"] => {
    if (!value || typeof value !== "object") return {};
    const record = value as Record<string, unknown>;
    return { ...(typeof record.model === "string" ? { model: record.model } : {}), ...(typeof record.effort === "string" ? { effort: record.effort } : {}), ...(["strict", "read-only", "workspace", "full-access"].includes(String(record.permission)) ? { permission: record.permission as SavedQueueMessage["options"]["permission"] } : {}) };
  };
  const queue = Array.isArray(record.queue) ? record.queue.flatMap((message) => message && typeof message.text === "string" ? [{ text: message.text, options: options(message.options) }] : []) : [];
  const pending = record.pending as Record<string, unknown> | undefined;
  return { text: typeof record.text === "string" ? record.text : "", options: options(record.options), queue, held: record.held === true, ...(pending && typeof pending.id === "string" && typeof pending.text === "string" ? { pending: { id: pending.id, text: pending.text, options: options(pending.options) } } : {}) };
}

export function recoveredLocalChatDraft(draft: LocalChatDraft): LocalChatDraft {
  if (!draft.pending) return draft;
  return { ...draft, text: [draft.pending.text, draft.text].filter(Boolean).join("\n\n"), options: draft.pending.options, held: true, pending: undefined };
}

export function settleLocalChatDraft(draft: LocalChatDraft, request: string, sent: boolean): LocalChatDraft {
  if (draft.pending?.id !== request) return draft;
  return sent ? { ...draft, pending: undefined } : recoveredLocalChatDraft(draft);
}
