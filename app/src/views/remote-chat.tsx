import { useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import { remoteChatApi } from "@/lib/remote-chat";
import { StructuredChat } from "@/views/local-chat";

export function RemoteChatPane({ box, id, cwd, draft, onDraftChange }: { box: string; id: string; cwd: string; draft?: string; onDraftChange(text: string): void }) {
  const client = useStore((s) => s.client);
  const transport = useMemo(() => client && ({
    read: (signal?: AbortSignal) => remoteChatApi.read(client, box, id, signal),
    message: (text: string) => remoteChatApi.message(client, box, id, text),
    stop: () => remoteChatApi.stop(client, box, id),
    interrupt: () => remoteChatApi.interrupt(client, box, id),
    approve: (approval: string, decision: "accept" | "decline") => remoteChatApi.approve(client, box, id, approval, decision),
  }), [client, box, id]);
  const onChange = useCallback(() => {}, []);
  return transport
    ? <StructuredChat key={`${box}/${id}`} transport={transport} session={{ id, agent: "codex", mode: "chat", cwd, state: "starting", started_at: "" }} onChange={onChange} testId="remote-chat" initialDraft={draft} onDraftChange={onDraftChange} />
    : <p role="status" className="p-4 text-sm">Connecting to {box}...</p>;
}
