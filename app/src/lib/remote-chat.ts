import { useEffect, useState } from "react";
import { ApiError, type Client } from "@/lib/api";
import type { LocalChat, ChatOptions, ChatModel, ChatDecision, LocalAgent } from "@/lib/local-computer";
import { localAgentName } from "@/lib/local-computer";
import { useStore } from "@/lib/store";
import { supportsStructuredChat } from "@/lib/structured-chat";
import { leaves } from "@/lib/layout";
import { openTab, pruneStaleRemoteChatTabs, showWorktree, useWorkspaces, wsKey, type WorktreeRef } from "@/lib/workspaces";

export interface RemoteChat extends LocalChat { location: string }
export type RemoteChatSummary = Omit<RemoteChat, "items" | "approvals">;
const path = (id: string) => `chats/${encodeURIComponent(id)}`;

async function mutation<T>(request: Promise<T>, launchAgent?: LocalAgent): Promise<T> {
  try { return await request; }
  catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) throw error;
    throw new Error(launchAgent
      ? `${localAgentName(launchAgent)} may have started. Open this project's chats before starting another. Nothing will be retried automatically.`
      : "The request may have arrived. Refresh the chat before acting again; nothing will be resent automatically.");
  }
}

export const remoteChatApi = {
  list: (client: Client, box: string, signal?: AbortSignal) => client.box<{ chats: RemoteChatSummary[] }>(box, "GET", "chats", undefined, signal),
  start: (client: Client, box: string, location: string, agent: LocalAgent = "codex") => mutation(client.box<RemoteChat>(box, "POST", "chats", { location, ...(agent === "claude" ? { agent } : {}) }), agent),
  read: (client: Client, box: string, id: string, signal?: AbortSignal) => client.box<RemoteChat>(box, "GET", path(id), undefined, signal),
  message: (client: Client, box: string, id: string, text: string, options?: ChatOptions) => mutation(client.box(box, "POST", `${path(id)}/messages`, { text, ...(options && Object.keys(options).length ? { options } : {}) })),
  models: (client: Client, box: string, id: string) => client.box<ChatModel[]>(box, "GET", `${path(id)}/models`),
  interrupt: (client: Client, box: string, id: string) => mutation(client.box(box, "POST", `${path(id)}/interrupt`)),
  stop: (client: Client, box: string, id: string) => mutation(client.box(box, "DELETE", path(id))),
  approve: (client: Client, box: string, id: string, approval: string, decision: ChatDecision) => mutation(client.box(box, "POST", `${path(id)}/approvals`, { id: approval, decision })),
};

// Older daemons reject unknown message fields, so options go only to boxes that say they take them.
export const hasChatOptions = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("chat.options");
export const hasFullAccess = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("chat.full-access");

// The account's own model list for the launcher, asked once per project for the chosen agent.
const listed = new Map<string, ChatModel[]>();
const asking = new Set<string>();
export function useChatModels(box: string, location: string, enabled: boolean, agent = "codex"): ChatModel[] | undefined {
  const client = useStore((s) => s.client);
  const key = `${box}/${location}/${agent}`;
  const [, shown] = useState(0);
  useEffect(() => {
    if (!client || !enabled || !location || listed.has(key) || asking.has(key)) return;
    asking.add(key);
    client.box<ChatModel[]>(box, "GET", `chats/models?location=${encodeURIComponent(location)}${agent === "claude" ? "&agent=claude" : ""}`)
      .then((models) => { listed.set(key, Array.isArray(models) ? models : []); shown((n) => n + 1); })
      // Without a list the launcher keeps the provider's default model; the chat's own selector can still ask.
      .catch(() => {})
      .finally(() => asking.delete(key));
  }, [client, box, location, key, enabled]);
  return enabled ? listed.get(key) : undefined;
}

export function hasRemoteChat(box: string, agent: string | undefined, command: string): agent is LocalAgent {
  return supportsStructuredChat(agent, command, useStore.getState().boxes[box]?.info?.capabilities);
}

// Recover views from the daemon's owned registry, never from folder history.
export function openRemoteChat(box: string, chat: RemoteChatSummary, ref: WorktreeRef, draft?: string, options?: ChatOptions) {
  const key = wsKey(box, ref.path);
  const existing = useWorkspaces.getState().spaces[key]?.tabs.find((tab) => leaves(tab.root).some((l) => l.content.kind === "remote-chat" && l.content.box === box && l.content.chat === chat.id));
  showWorktree(key);
  if (existing) {
    useWorkspaces.setState((s) => ({ spaces: { ...s.spaces, [key]: { ...s.spaces[key], active: existing.id } } }));
  } else openTab({ kind: "remote-chat", box, chat: chat.id, cwd: chat.cwd, agent: chat.agent, draft, options }, key);
}

export function useBoxRemoteChats(box: string) {
  const client = useStore((s) => s.client);
  const supported = useStore((s) => s.boxes[box]?.info?.capabilities?.some((c) => c === "chat.codex" || c === "chat.claude"));
  const [chats, setChats] = useState<RemoteChatSummary[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setChats([]);
    setError("");
    if (!client || !supported) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const result = await remoteChatApi.list(client, box, controller.signal);
        if (!controller.signal.aborted) {
          pruneStaleRemoteChatTabs(box, new Set(result.chats.map((chat) => chat.id)));
          setChats(result.chats ?? []);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) setError("Could not refresh chats on this box. Existing chats have not been restarted.");
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void read(), 3000);
    };
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [client, box, supported]);
  return { chats, error, supported: !!supported };
}

export function useRemoteChats(box: string, location: string) {
  const { chats, error } = useBoxRemoteChats(box);
  return { chats: chats.filter((chat) => chat.location === location), error };
}

// Match a structured chat to a worktree by location name or cwd under its path.
export function chatBelongsToWorktree(chat: RemoteChatSummary, loc: { name: string }, wt: { name: string; path: string; main?: boolean }): boolean {
  const location = wt.main ? loc.name : `${loc.name}/${wt.name}`;
  if (chat.location === location) return true;
  const cwd = chat.cwd.replace(/\\/g, "/");
  const path = wt.path.replace(/\\/g, "/");
  return cwd === path || cwd.startsWith(path.endsWith("/") ? path : `${path}/`);
}
