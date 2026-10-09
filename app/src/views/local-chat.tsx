import { useEffect, useMemo, useState } from "react";
import type { ThreadMessageLike } from "@assistant-ui/react";

import { Chat } from "@/components/chat/chat";
import { chatMessage } from "@/components/chat/chat-messages";
import type { Client } from "@/lib/api";
import { threadTurns } from "@/lib/chat-thread";
import { localApi, localAgentName, type ChatDecision, type ChatOptions, type LocalSession } from "@/lib/local-computer";
import { savedChatMessages } from "@/lib/saved-chat";

export function LocalChat({ client, session, onChange }: { client: Client; session: LocalSession; onChange(session: LocalSession): void }) {
  const [prior, setPrior] = useState<readonly ThreadMessageLike[]>([]);
  useEffect(() => {
    if (!session.history_id) {
      setPrior([]);
      return;
    }
    const controller = new AbortController();
    void localApi.history(client, session.history_id, undefined, controller.signal).then((page) => {
      if (!controller.signal.aborted) setPrior(savedChatMessages(page.items ?? []));
    }).catch(() => {});
    return () => controller.abort();
  }, [client, session.history_id]);
  const transport = useMemo(() => ({
    session, agentName: localAgentName(session.agent), testId: "local-chat", onChange: (value: { state: LocalSession["state"] }) => onChange({ ...session, state: value.state }),
    read: async (signal?: AbortSignal) => {
      const chat = await localApi.chat(client, session.id, signal);
      if (!prior.length) return chat;
      const live = threadTurns(chat.items, chat.state === "running" || chat.state === "waiting").map(chatMessage);
      return { ...chat, messages: [...prior, ...live] };
    },
    message: (text: string, options?: ChatOptions) => localApi.message(client, session.id, text, options),
    models: () => localApi.models(client, session.id),
    stop: () => localApi.stopChat(client, session.id),
    interrupt: () => localApi.interruptChat(client, session.id),
    approve: (id: string, decision: ChatDecision) => localApi.approveChat(client, session.id, id, decision),
  }), [client, session, onChange, prior]);
  return <Chat transport={transport} />;
}
