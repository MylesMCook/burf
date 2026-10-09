import { useMemo } from "react";
import { Chat } from "@/components/chat/chat";
import type { Client } from "@/lib/api";
import { localApi, localAgentName, type LocalSession, type ChatOptions, type ChatDecision } from "@/lib/local-computer";

export function LocalChat({ client, session, onChange }: { client: Client; session: LocalSession; onChange(session: LocalSession): void }) {
  const transport = useMemo(() => ({
    session, agentName: localAgentName(session.agent), testId: "local-chat", onChange: (value: { state: LocalSession["state"] }) => onChange({ ...session, state: value.state }),
    read: (signal?: AbortSignal) => localApi.chat(client, session.id, signal),
    message: (text: string, options?: ChatOptions) => localApi.message(client, session.id, text, options),
    models: () => localApi.models(client, session.id),
    stop: () => localApi.stopChat(client, session.id),
    interrupt: () => localApi.interruptChat(client, session.id),
    approve: (id: string, decision: ChatDecision) => localApi.approveChat(client, session.id, id, decision),
  }), [client, session, onChange]);
  return <Chat transport={transport} />;
}
