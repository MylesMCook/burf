import { useEffect, useState } from "react";
import { ApiError, type Client } from "@/lib/api";
import type { LocalChat, ChatOptions, ChatModel, ChatDecision } from "@/lib/local-computer";
import { useStore } from "@/lib/store";
import { leaves } from "@/lib/layout";
import { openTab, showWorktree, useWorkspaces, wsKey, type WorktreeRef } from "@/lib/workspaces";

export interface RemoteChat extends LocalChat { location: string }
export type RemoteChatSummary = Omit<RemoteChat, "items" | "approvals">;
const path = (id: string) => `chats/${encodeURIComponent(id)}`;

async function mutation<T>(request: Promise<T>, launch = false): Promise<T> {
  try { return await request; }
  catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) throw error;
    throw new Error(launch
      ? "Codex may have started. Open this project's chats before starting another. Nothing will be retried automatically."
      : "The request may have arrived. Refresh the chat before acting again; nothing will be resent automatically.");
  }
}

export const remoteChatApi = {
  list: (client: Client, box: string, signal?: AbortSignal) => client.box<{ chats: RemoteChatSummary[] }>(box, "GET", "chats", undefined, signal),
  start: (client: Client, box: string, location: string) => mutation(client.box<RemoteChat>(box, "POST", "chats", { location }), true),
  read: (client: Client, box: string, id: string, signal?: AbortSignal) => client.box<RemoteChat>(box, "GET", path(id), undefined, signal),
  message: (client: Client, box: string, id: string, text: string, options?: ChatOptions) => mutation(client.box(box, "POST", `${path(id)}/messages`, { text, ...(options && Object.keys(options).length ? { options } : {}) })),
  models: (client: Client, box: string, id: string) => client.box<ChatModel[]>(box, "GET", `${path(id)}/models`),
  interrupt: (client: Client, box: string, id: string) => mutation(client.box(box, "POST", `${path(id)}/interrupt`)),
  stop: (client: Client, box: string, id: string) => mutation(client.box(box, "DELETE", path(id))),
  approve: (client: Client, box: string, id: string, approval: string, decision: ChatDecision) => mutation(client.box(box, "POST", `${path(id)}/approvals`, { id: approval, decision })),
};

// Older daemons reject unknown message fields, so options go only to boxes that say they take them.
export const hasChatOptions = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("chat.options");

export function hasRemoteCodex(box: string, command: string): boolean {
  return command === "codex" && !!useStore.getState().boxes[box]?.info?.capabilities?.includes("chat.codex");
}

// Recover views from the daemon's owned registry, never from folder history.
export function openRemoteChat(box: string, chat: RemoteChatSummary, ref: WorktreeRef, draft?: string, options?: ChatOptions) {
  const key = wsKey(box, ref.path);
  const existing = useWorkspaces.getState().spaces[key]?.tabs.find((tab) => leaves(tab.root).some((l) => l.content.kind === "remote-chat" && l.content.box === box && l.content.chat === chat.id));
  showWorktree(key);
  if (existing) {
    useWorkspaces.setState((s) => ({ spaces: { ...s.spaces, [key]: { ...s.spaces[key], active: existing.id } } }));
  } else openTab({ kind: "remote-chat", box, chat: chat.id, cwd: chat.cwd, draft, options }, key);
}

export function useRemoteChats(box: string, location: string) {
  const client = useStore((s) => s.client);
  const supported = useStore((s) => s.boxes[box]?.info?.capabilities?.includes("chat.codex"));
  const [chats, setChats] = useState<RemoteChatSummary[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setChats([]); setError("");
    if (!client || !supported) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const result = await remoteChatApi.list(client, box, controller.signal);
        if (!controller.signal.aborted) { setChats(result.chats.filter((chat) => chat.location === location)); setError(""); }
      } catch { if (!controller.signal.aborted) setError("Could not refresh chats on this box. Existing chats have not been restarted."); }
      if (!controller.signal.aborted) timer = setTimeout(() => void read(), 3000);
    };
    void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [client, box, location, supported]);
  return { chats, error };
}
