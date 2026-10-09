import { folderChoices, folderName } from "./local-folders.ts";
import type { LocalConversation, LocalSession } from "./local-computer.ts";

export type LocalThreadRow = {
  id: string;
  title: string;
  cwd: string;
  kind: "session" | "history";
  state?: LocalSession["state"];
  session?: LocalSession;
  conversation?: LocalConversation;
};

export function buildLocalThreadRows(conversations: LocalConversation[], sessions: LocalSession[]): LocalThreadRow[] {
  const hiddenHistory = new Set<string>();
  for (const session of sessions) {
    if (session.state !== "exited" && session.history_id) hiddenHistory.add(session.history_id);
  }
  const rows: LocalThreadRow[] = [];
  for (const session of sessions) {
    rows.push({
      id: `session:${session.id}`,
      title: session.title?.trim() || "Untitled",
      cwd: session.cwd,
      kind: "session",
      state: session.state,
      session,
    });
  }
  for (const conversation of conversations) {
    if (hiddenHistory.has(conversation.id)) continue;
    rows.push({
      id: `history:${conversation.id}`,
      title: conversation.title?.trim() || "Untitled",
      cwd: conversation.cwd,
      kind: "history",
      conversation,
    });
  }
  return rows;
}

export function groupLocalThreadRows(rows: LocalThreadRow[]): { cwd: string; label: string; hint: string; rows: LocalThreadRow[] }[] {
  const labels = new Map(folderChoices([...new Set(rows.map((r) => r.cwd))]).map((c) => [c.value, c]));
  const groups = new Map<string, LocalThreadRow[]>();
  for (const row of rows) {
    const list = groups.get(row.cwd) ?? [];
    list.push(row);
    groups.set(row.cwd, list);
  }
  return [...groups.entries()].map(([cwd, list]) => ({
    cwd,
    label: labels.get(cwd)?.label ?? (folderName(cwd) || "Unknown project"),
    hint: labels.get(cwd)?.hint ?? cwd,
    rows: list,
  }));
}
