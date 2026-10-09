import type { AttachmentAdapter, ThreadMessageLike } from "@assistant-ui/react";
import type { ChatDecision, ChatModel, ChatOptions, LocalChat, LocalSession } from "@/lib/local-computer";

// A transport supplies session data and capabilities, never a composer or a view.
export type ChatSession = Omit<LocalSession, "agent"> & { agent: string };
export type ChatSnapshot = Omit<LocalChat, "agent"> & { agent: string; messages?: readonly ThreadMessageLike[] };

export interface ChatTransport {
  session: ChatSession;
  agentName: string;
  testId?: string;
  initialDraft?: string;
  inputLabel?: string;
  placeholder?: string;
  recall?: { box: string; session: string };
  subscribeDraft?(fill: (value: { text: string; send?: boolean }) => void): () => void;
  sendDisabled?: boolean;
  onError?(error: unknown): void;
  commands?: readonly { name: string; description?: string }[];
  // Terminal-backed transports already own their queue and its idempotency keys.
  queueOnServer?: boolean;
  snapshot?: ChatSnapshot;
  refresh?(): Promise<void>;
  initialOptions?: ChatOptions;
  onChange?(session: ChatSession): void;
  onDraftChange?(text: string): void;
  onOptionsChange?(options: ChatOptions): void;
  read(signal?: AbortSignal): Promise<ChatSnapshot>;
  message?(text: string, options?: ChatOptions): Promise<unknown>;
  models?(): Promise<ChatModel[]>;
  stop?(): Promise<unknown>;
  interrupt?(): Promise<unknown>;
  approve?(id: string, decision: ChatDecision): Promise<unknown>;
  attachments?: AttachmentAdapter;
  searchFiles?(query: string, signal?: AbortSignal): Promise<string[]>;
}
