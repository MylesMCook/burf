import { useEffect, useState } from "react";
import type { Client } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { TranscriptItem } from "@/lib/transcript";

export type LocalAgent = "claude" | "codex";
export const localAgentName = (id: string) => id === "claude" ? "Claude Code" : "Codex";
export interface LocalSession {
  id: string;
  agent: LocalAgent;
  cwd: string;
  state: "running" | "exited";
  started_at: string;
  exit_error?: string;
}
export interface LocalComputer {
  supported: boolean;
  name: string;
  home: string;
  agents: { id: LocalAgent; available: boolean }[];
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

export const localApi = {
  status: (c: Client, signal?: AbortSignal) => c.laptop<LocalComputer>("GET", "/v1/local", undefined, signal),
  conversations: (c: Client, signal?: AbortSignal) => c.laptop<LocalConversation[]>("GET", "/v1/local/conversations", undefined, signal),
  history: (c: Client, id: string, before?: number, signal?: AbortSignal) => c.laptop<LocalHistoryPage>("GET", `/v1/local/conversations/${encodeURIComponent(id)}${before === undefined ? "" : `?before=${before}`}`, undefined, signal),
  start: (c: Client, agent: LocalAgent, cwd: string) => c.laptop<LocalSession>("POST", "/v1/local/sessions", { agent, cwd }),
  stop: (c: Client, id: string) => c.laptop("DELETE", `/v1/local/sessions/${encodeURIComponent(id)}`),
  output: (c: Client, id: string, after: number, signal?: AbortSignal) => c.laptop<LocalOutput>("GET", `/v1/local/sessions/${encodeURIComponent(id)}/output?after=${after}`, undefined, signal),
  input: (c: Client, id: string, data: string, signal?: AbortSignal) => c.laptop("POST", `/v1/local/sessions/${encodeURIComponent(id)}/input`, { data }, signal),
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
