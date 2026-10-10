import * as stylex from "@stylexjs/stylex";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { remoteChatApi } from "@/lib/remote-chat";
import { Chat } from "@/components/chat/chat";
import { useWorktreeAttachments } from "@/components/conversation/structured-attachments";
import { PaneContext } from "@/lib/pane-context";
import { useWorktreeRef } from "@/lib/workspaces";
import { filesApi } from "@/lib/files";
import { localAgentName, type LocalAgent, type ChatDecision, type ChatOptions } from "@/lib/local-computer";

const paint = stylex.create({
  s0: {
    "padding": "16px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type Saved = { draft?: string; options?: { model?: string; effort?: string } };

export function RemoteChatPane({ box, id, cwd, agent, draft, options, onSaved }: { box: string; id: string; cwd: string; agent?: LocalAgent; onSaved(saved: Saved): void } & Saved) {
  // A send clears the draft and its choices together: each save carries both, so neither restores the other.
  const [provider, setProvider] = useState(agent);
  const key = `${box}/${id}`;
  useEffect(() => setProvider(agent), [key, agent]);
  const saved = useRef({ key, draft, options });
  if (saved.current.key !== key) saved.current = { key, draft, options };
  const save = (change: Saved) => { saved.current = { ...saved.current, ...change }; onSaved({ draft: saved.current.draft, options: saved.current.options }); };
  const client = useStore((s) => s.client);
  const saveRef = useRef(save); saveRef.current = save;
  const initial = useRef({ key, draft, options });
  if (initial.current.key !== key) initial.current = { key, draft, options };
  const worktree = useContext(PaneContext)?.worktree;
  const paneRef = useWorktreeRef(worktree);
  const target = paneRef && paneRef.box === box && paneRef.path === cwd ? paneRef : undefined;
  const attachments = useWorktreeAttachments(client, target);
  const transport = useMemo(() => client && ({
    session: { id, agent: provider ?? "unknown", mode: "chat" as const, cwd, state: "starting" as const, started_at: "" },
    agentName: provider ? localAgentName(provider) : "Agent", testId: "remote-chat", initialDraft: initial.current.draft, initialOptions: initial.current.options,
    onDraftChange: (text: string) => saveRef.current({ draft: text || undefined }),
    onOptionsChange: (o: ChatOptions) => saveRef.current({ options: o.model || o.effort ? { model: o.model, effort: o.effort } : undefined }),
    attachments,
    searchFiles: target ? async (query: string, signal?: AbortSignal) => (await filesApi.list(client, target, query, 8, signal)).files ?? [] : undefined,
    read: async (signal?: AbortSignal) => { const chat = await remoteChatApi.read(client, box, id, signal); if (!signal?.aborted) setProvider(chat.agent ?? "codex"); return chat; },
    message: (text: string, options?: ChatOptions) => remoteChatApi.message(client, box, id, text, options),
    models: () => remoteChatApi.models(client, box, id),
    stop: () => remoteChatApi.stop(client, box, id),
    interrupt: () => remoteChatApi.interrupt(client, box, id),
    approve: (approval: string, decision: ChatDecision) => remoteChatApi.approve(client, box, id, approval, decision),
  }), [client, box, id, cwd, provider, attachments, target]);
  return transport
    ? <Chat key={key} transport={transport} />
    : <p role="status" className={sx(paint.s0)}>Connecting to {box}...</p>;
}
