import { create } from "zustand";

import { errorMessage } from "@/lib/format";
import { localApi, type LocalComputer, type LocalConversation, type LocalSession } from "@/lib/local-computer";
import { useStore } from "@/lib/store";

// The one list for This computer. The sidebar draws it. The main area
// draws the open chat. There is not a second sidebar.
export type LocalPick = { kind: "history"; id: string } | { kind: "session"; id: string };

interface Desk {
  computer?: LocalComputer;
  conversations: LocalConversation[];
  loading: boolean;
  error: string;
  pick?: LocalPick;
}

export const useLocalDesk = create<Desk>(() => ({ conversations: [], loading: false, error: "" }));

let inflight: AbortController | null = null;

export function refreshLocalDesk(): Promise<void> {
  const client = useStore.getState().client;
  if (!client) return Promise.resolve();
  inflight?.abort();
  const controller = new AbortController();
  inflight = controller;
  useLocalDesk.setState({ loading: true, error: "" });
  return localApi.status(client, controller.signal).then(async (computer) => {
    if (controller.signal.aborted) return;
    const conversations = computer.supported ? (await localApi.conversations(client, controller.signal)) ?? [] : [];
    if (controller.signal.aborted) return;
    useLocalDesk.setState({ computer, conversations, loading: false });
  }).catch((e: unknown) => {
    if (!controller.signal.aborted) useLocalDesk.setState({ loading: false, error: errorMessage(e) });
  });
}

export function pickLocal(pick: LocalPick | undefined) {
  useLocalDesk.setState({ pick });
  if (pick?.kind === "session") {
    const session = useLocalDesk.getState().computer?.sessions.find((s) => s.id === pick.id);
    useStore.getState().setView(session ? { kind: "local", session } : { kind: "local" });
    return;
  }
  if (useStore.getState().view.kind !== "local") useStore.getState().setView({ kind: "local" });
}

export function noteLocalSession(session: LocalSession) {
  useLocalDesk.setState((s) => ({
    computer: s.computer
      ? { ...s.computer, sessions: [session, ...(s.computer.sessions ?? []).filter((x) => x.id !== session.id)] }
      : s.computer,
  }));
}
