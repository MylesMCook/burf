import type { LocalConversation, LocalSession } from "./local-computer.ts";

export function folderName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

// A folder appears once, at its most recent conversation or live session.
export function localFolders(conversations: LocalConversation[], sessions: LocalSession[]): string[] {
  const recent = new Map<string, number>();
  const add = (path: string, date: string) => {
    if (!path) return;
    const time = Date.parse(date) || 0;
    recent.set(path, Math.max(recent.get(path) ?? 0, time));
  };
  for (const conversation of conversations) add(conversation.cwd, conversation.updated_at);
  for (const session of sessions) if (session.state !== "exited") add(session.cwd, session.started_at);
  return [...recent].sort((a, b) => b[1] - a[1]).map(([path]) => path);
}
