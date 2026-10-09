import type { BerthReport } from "@/lib/transcript";
import { useEffect, useState } from "react";
import { load, save } from "@/lib/storage";
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
  // Whether its folder can be used here, and when not, why. An older
  // backend says neither: then it is tried, and the launch says if not.
  can_continue?: boolean;
  continue_reason?: string;
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

export type ChatDecision = "accept" | "decline" | "acceptForSession" | "acceptAlways";
export interface ChatOptions { model?: string; effort?: string; permission?: "strict" | "read-only" | "workspace" | "full-access" }
// What Codex may do without asking. Network stays off in every mode but Full access.
export const chatPermissions = {
  strict: { label: "Ask every time", hint: "Codex asks before any command it does not already trust. No edits." },
  "read-only": { label: "Read only", hint: "Codex reads and runs sandboxed commands without asking. Edits need approval." },
  workspace: { label: "Edit workspace", hint: "Codex edits files in this workspace without asking. Anything outside it needs approval." },
  "full-access": { label: "Full access", hint: "Codex runs any command and changes any file this account can reach, with network access, without asking." },
} as const;
// Backends that predate a mode do not list it, and are never sent it.
export const BASE_PERMISSIONS = ["strict", "read-only", "workspace"];
const CHAT_PERMISSION = "berth.chat.permission";
// The mode last chosen, offered to the next new chat where its backend takes it. It is applied by a message, never on its own.
export function savedChatPermission(): ChatOptions["permission"] {
  const saved = load<string>(CHAT_PERMISSION, "");
  return saved in chatPermissions ? (saved as ChatOptions["permission"]) : undefined;
}
export const saveChatPermission = (permission: NonNullable<ChatOptions["permission"]>) => save(CHAT_PERMISSION, permission);
export interface ChatModel { model: string; displayName: string; defaultReasoningEffort: string; supportedReasoningEfforts: { reasoningEffort: string }[] }
export interface LocalChat extends LocalSession {
  composer?: boolean;
  options?: ChatOptions;
  permissions?: string[];
  thread_id: string;
  turn_id?: string;
  // report: Burf's own message, what became of work the chat started (chat.tools).
  items: { id: string; kind: "user" | "assistant" | "tool" | "report"; text: string; status?: string }[];
  // The work each report item tells of, by item id.
  reports?: Record<string, BerthReport[]>;
  // browser and tool: one of Burf's own tools asks before it acts.
  approvals: { id: string; kind: "command" | "files" | "browser" | "tool"; detail: string; reason?: string; session_allowed?: boolean; execpolicy?: string[] }[];
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
  message: (c: Client, id: string, text: string, options?: ChatOptions) => chatMutation(c.laptop("POST", `${chatPath(id)}/messages`, { text, ...(options && Object.keys(options).length ? { options } : {}) })),
  models: (c: Client, id: string) => c.laptop<ChatModel[]>("GET", `${chatPath(id)}/models`),
  interruptChat: (c: Client, id: string) => chatMutation(c.laptop("POST", `${chatPath(id)}/interrupt`)),
  approveChat: (c: Client, id: string, approval: string, decision: ChatDecision) => chatMutation(c.laptop("POST", `${chatPath(id)}/approvals`, { id: approval, decision })),
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
export function useLocalComputer(enabled = true) {
  const client = useStore((s) => s.client);
  const [local, setLocal] = useState<LocalComputer>();
  useEffect(() => {
    setLocal(undefined);
    if (!client || !enabled) return;
    const controller = new AbortController();
    void localApi.status(client, controller.signal).then((value) => {
      if (!controller.signal.aborted) setLocal(value);
    }).catch(() => {});
    return () => controller.abort();
  }, [client, enabled]);
  return local;
}
