import { useEffect, useState } from "react";
import { ApiError, type Client } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { TranscriptItem } from "@/lib/transcript";

export type LocalAgent = "claude" | "codex";
export const localAgentName = (id: string) => id === "claude" ? "Claude Code" : "Codex";
export interface LocalSession {
  id: string;
  agent: LocalAgent;
  cwd: string;
  state: "running" | "exited" | "idle" | "waiting" | "starting";
  mode?: "chat";
  started_at: string;
  exit_error?: string;
}
export interface LocalComputer {
  supported: boolean;
  name: string;
  home: string;
  agents: { id: LocalAgent; available: boolean; can_fork?: boolean; can_chat?: boolean }[];
  sessions: LocalSession[];
}
export interface LocalConversation {
  id: string;
  source: string;
  title: string;
  cwd: string;
  updated_at: string;
  read_only: true;
}
export interface LocalHistoryPage {
  items: (TranscriptItem & { off?: number })[];
  start?: number;
  more?: boolean;
}
export interface LocalOutput {
  data: string;
  next: number;
  reset: boolean;
  state: LocalSession["state"];
  exit_error?: string;
}

export interface LocalChat extends LocalSession {
  thread_id: string;
  turn_id?: string;
  items: { id: string; kind: "user" | "assistant" | "tool"; text: string; status?: string }[];
  approvals: { id: string; kind: "command" | "files"; detail: string; reason?: string }[];
  error?: string;
  truncated?: boolean;
}

const chatPath = (id: string) => `/v1/local/chats/${encodeURIComponent(id)}`;
async function chatMutation(request: Promise<unknown>) {
  try { return await request; }
  catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
    throw new Error("The request may have arrived. Refresh the chat before acting again; nothing will be resent automatically.");
  }
}

async function launch<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  try { return await request; }
  catch (e) {
    if (signal?.aborted || e instanceof ApiError && (e.status >= 400 && e.status < 500 && e.status !== 408 || e.code === "agent_restarting")) throw e;
    throw new Error("The agent may have started. Refresh This computer to find it before trying again.");
  }
}

export const localApi = {
  startChat: (c: Client, cwd: string, signal?: AbortSignal) => launch(c.laptop<LocalChat>("POST", "/v1/local/chats", { cwd }, signal), signal),
  chat: (c: Client, id: string, signal?: AbortSignal) => c.laptop<LocalChat>("GET", chatPath(id), undefined, signal),
  message: (c: Client, id: string, text: string) => chatMutation(c.laptop("POST", `${chatPath(id)}/messages`, { text })),
  interruptChat: (c: Client, id: string) => chatMutation(c.laptop("POST", `${chatPath(id)}/interrupt`)),
  approveChat: (c: Client, id: string, approval: string, decision: "accept" | "decline") => chatMutation(c.laptop("POST", `${chatPath(id)}/approvals`, { id: approval, decision })),
  stopChat: (c: Client, id: string) => chatMutation(c.laptop("DELETE", chatPath(id))),
  status: (c: Client, signal?: AbortSignal) => c.laptop<LocalComputer>("GET", "/v1/local", undefined, signal),
  conversations: (c: Client, signal?: AbortSignal) => c.laptop<LocalConversation[]>("GET", "/v1/local/conversations", undefined, signal),
  history: (c: Client, id: string, before?: number, signal?: AbortSignal) => c.laptop<LocalHistoryPage>("GET", `/v1/local/conversations/${encodeURIComponent(id)}${before === undefined ? "" : `?before=${before}`}`, undefined, signal),
  start: (c: Client, agent: LocalAgent, cwd: string, signal?: AbortSignal) => launch(c.laptop<LocalSession>("POST", "/v1/local/sessions", { agent, cwd }, signal), signal),
  fork: (c: Client, id: string, signal?: AbortSignal) => launch(c.laptop<LocalSession>("POST", `/v1/local/conversations/${encodeURIComponent(id)}/fork`, undefined, signal), signal),
  stop: (c: Client, id: string) => c.laptop("DELETE", `/v1/local/sessions/${encodeURIComponent(id)}`),
  output: (c: Client, id: string, after: number, signal?: AbortSignal) => c.laptop<LocalOutput>("GET", `/v1/local/sessions/${encodeURIComponent(id)}/output?after=${after}`, undefined, signal),
  input: async (c: Client, id: string, data: string, signal?: AbortSignal) => {
    try { return await c.laptop("POST", `/v1/local/sessions/${encodeURIComponent(id)}/input`, { data }, signal); }
    catch (e) {
      if (e instanceof ApiError && e.status > 0 && e.status < 500) throw e;
      throw new Error("Terminal input may have arrived. Check the agent before sending it again. Reconnecting will not resend it.");
    }
  },
  resize: (c: Client, id: string, cols: number, rows: number, signal?: AbortSignal) => c.laptop("POST", `/v1/local/sessions/${encodeURIComponent(id)}/resize`, { cols, rows }, signal),
};

// Older agents have no local API. Its absence must not hide paired boxes.
export function useLocalComputer() {
  const client = useStore((s) => s.client);
  const [local, setLocal] = useState<LocalComputer>();
  useEffect(() => {
    setLocal(undefined);
    if (!client) return;
    const controller = new AbortController();
    void localApi.status(client, controller.signal).then((value) => {
      if (!controller.signal.aborted) setLocal(value);
    }).catch(() => {});
    return () => controller.abort();
  }, [client]);
  return local;
}
