import type { LocalConversation, LocalSession } from "./local-computer.ts";

export function folderName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

// folderChoices names each path by its folder. Two with the same name keep
// the parent, shortened, so a list of "repo" can still be told apart.
export function folderChoices(paths: string[]): { value: string; label: string; hint: string }[] {
  const rows = paths.map((path) => ({ value: path, name: folderName(path) }));
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  return rows.map((row) => {
    const hint = row.value;
    if ((counts.get(row.name) ?? 0) < 2) return { value: row.value, label: row.name, hint };
    const parts = row.value.replace(/[\\/]+$/, "").split(/[\\/]/);
    const parent = parts.length >= 2 ? parts[parts.length - 2] : "";
    const short = parent.length > 22 ? `${parent.slice(0, 10)}…${parent.slice(-8)}` : parent;
    return { value: row.value, label: short ? `${short}/${row.name}` : row.name, hint };
  });
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
