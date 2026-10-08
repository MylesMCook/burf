import { useEffect, useMemo, useState } from "react";

import { chatAt } from "@/lib/chat-target";
import { agentOf } from "@/lib/derive";
import { send as sendPrompt } from "@/lib/orchestrate";
import { remoteChatApi, type RemoteChatSummary } from "@/lib/remote-chat";
import { useStore } from "@/lib/store";

// Where "Send to agent" goes from a worktree's browser: the agent in its
// terminal, held until it is idle, or else the worktree's Codex chat. A
// chat takes a message only between turns, so one that is working or
// waiting says so instead of losing what was sent.

export interface AgentTarget {
  // Why nothing can be sent just now, for the note field.
  blocked?: string;
  send(text: string): Promise<void>;
}

export function useAgentTarget(ref?: { box: string; path: string }): AgentTarget | undefined {
  const box = ref?.box;
  const path = ref?.path;
  const client = useStore((s) => s.client);
  const session = useStore((s) => (box ? s.boxes[box]?.sessions?.find((x) => x.dir === path && !x.exited && agentOf(x))?.name : undefined));
  const chats = useStore((s) => !!box && !!s.boxes[box]?.info?.capabilities?.includes("chat.codex"));
  const [chat, setChat] = useState<RemoteChatSummary>();
  useEffect(() => {
    setChat(undefined);
    if (!client || !box || !path || session || !chats) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const found = chatAt((await remoteChatApi.list(client, box, controller.signal)).chats, path);
        if (!controller.signal.aborted) setChat(found);
      } catch { /* The next read says. */ }
      if (!controller.signal.aborted) timer = setTimeout(() => void read(), 2000);
    };
    void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [client, box, path, session, chats]);
  return useMemo(() => {
    if (!box) return undefined;
    if (session) return { send: async (text: string) => { await sendPrompt(box, session, text, { when: "idle" }); } };
    if (!client || !chat) return undefined;
    return {
      blocked: chat.state === "idle" ? undefined : chat.state === "waiting" ? "Codex is waiting for an approval in its chat" : "Codex is working. Send this when its turn ends",
      send: async (text: string) => { await remoteChatApi.message(client, box, chat.id, text); },
    };
  }, [box, session, client, chat]);
}
