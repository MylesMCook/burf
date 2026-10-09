import { useCallback, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import { remoteChatApi } from "@/lib/remote-chat";
import { StructuredChat } from "@/views/local-chat";
import type { ChatDecision, ChatOptions } from "@/lib/local-computer";

type Saved = { draft?: string; options?: { model?: string; effort?: string } };

export function RemoteChatPane({ box, id, cwd, draft, options, onSaved }: { box: string; id: string; cwd: string; onSaved(saved: Saved): void } & Saved) {
  // A send clears the draft and its choices together: each save carries both, so neither restores the other.
  const key = `${box}/${id}`;
  const saved = useRef({ key, draft, options });
  if (saved.current.key !== key) saved.current = { key, draft, options };
  const save = (change: Saved) => { saved.current = { ...saved.current, ...change }; onSaved({ draft: saved.current.draft, options: saved.current.options }); };
  const client = useStore((s) => s.client);
  const transport = useMemo(() => client && ({
    box,
    read: (signal?: AbortSignal) => remoteChatApi.read(client, box, id, signal),
    message: (text: string, options?: ChatOptions) => remoteChatApi.message(client, box, id, text, options),
    models: () => remoteChatApi.models(client, box, id),
    stop: () => remoteChatApi.stop(client, box, id),
    interrupt: () => remoteChatApi.interrupt(client, box, id),
    approve: (approval: string, decision: ChatDecision) => remoteChatApi.approve(client, box, id, approval, decision),
  }), [client, box, id]);
  const onChange = useCallback(() => {}, []);
  return transport
    ? <StructuredChat key={key} transport={transport} session={{ id, agent: "codex", mode: "chat", cwd, state: "starting", started_at: "" }} onChange={onChange} testId="remote-chat" initialDraft={draft} onDraftChange={(text) => save({ draft: text || undefined })} initialOptions={options} onOptionsChange={(o) => save({ options: o.model || o.effort ? { model: o.model, effort: o.effort } : undefined })} />
    : <p role="status" className="p-4 text-sm">Connecting to {box}...</p>;
}
