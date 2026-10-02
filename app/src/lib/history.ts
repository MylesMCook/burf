import type { Client } from "@/lib/api";
import { useStore } from "@/lib/store";

// Agent history: what every session showed, kept by each box after the
// session is gone, and Claude Code's own transcripts with their turns. See
// internal/box/history.go. Nothing here is sent anywhere but the box it
// came from; lines that look like secrets arrive already hidden.

export interface HistorySession {
  id: string;
  source: "terminal" | "claude";
  name?: string;
  agent?: string;
  location?: string;
  // Empty for the repository's own checkout.
  worktree?: string;
  path?: string;
  branch?: string;
  command?: string;
  title?: string;
  started?: string;
  updated?: string;
  ended: boolean;
  state?: string;
  lines: number;
  // The live tmux session, while there is one.
  running?: string;
  linked?: string[];
}

export interface HistoryMatch {
  session: HistorySession;
  // The line (terminal) or turn (Claude) it is at.
  position: number;
  time?: string;
  role?: string;
  line: string;
  // On the terminal's last screen rather than in its log.
  screen?: boolean;
  before: string[];
  after: string[];
}

export interface Turn {
  n: number;
  role: "user" | "assistant" | "tool" | "result";
  time?: string;
  text: string;
  tool?: string;
}

export interface TranscriptLine {
  n: number;
  time?: string;
  text: string;
}

export interface Transcript {
  session: HistorySession;
  from: number;
  total: number;
  lines?: TranscriptLine[];
  screen?: string[];
  turns?: Turn[];
}

export interface HistoryFilter {
  // One recorded session's id.
  session?: string;
  agent?: string;
  // "cal" or "cal/billing"
  location?: string;
  source?: "terminal" | "claude";
  // An RFC 3339 time or an age such as 7d.
  since?: string;
  limit?: number;
}

const query = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const historyApi = {
  sessions: (c: Client, box: string, f: HistoryFilter = {}) => c.box<HistorySession[]>(box, "GET", `history${query({ ...f })}`),
  search: (c: Client, box: string, q: string, f: HistoryFilter & { regexp?: boolean } = {}) =>
    c.box<HistoryMatch[]>(box, "GET", `history${query({ ...f, regexp: f.regexp ? 1 : undefined, q })}`),
  read: (c: Client, box: string, id: string, from = 0, limit = 500) => c.box<Transcript>(box, "GET", `history/${encodeURIComponent(id)}${query({ from, limit })}`),
};

// On every box: what each answered, and which could not.
export interface Across<T> {
  items: (T & { box: string })[];
  failed: { box: string; error: string }[];
}

export async function acrossBoxes<T>(fn: (c: Client, box: string) => Promise<T[]>, boxes?: string[]): Promise<Across<T>> {
  const st = useStore.getState();
  const c = st.client;
  if (!c) return { items: [], failed: [] };
  const online = (st.status?.boxes ?? []).filter((b) => b.state === "online").map((b) => b.name);
  const names = boxes?.length ? online.filter((b) => boxes.includes(b)) : online;
  const out: Across<T> = { items: [], failed: [] };
  const results = await Promise.allSettled(names.map((box) => fn(c, box)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.items.push(...(r.value ?? []).map((v) => ({ ...v, box: names[i] })));
    else out.failed.push({ box: names[i], error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  return out;
}

export const searchHistory = (q: string, f: HistoryFilter & { regexp?: boolean } = {}, boxes?: string[]) => acrossBoxes((c, box) => historyApi.search(c, box, q, f), boxes);

export const listHistory = (f: HistoryFilter = {}, boxes?: string[]) => acrossBoxes((c, box) => historyApi.sessions(c, box, f), boxes);

// where names a recorded session's place: "cal / billing", or its folder.
export function historyWhere(s: HistorySession): string {
  if (s.location) return s.worktree ? `${s.location} / ${s.worktree}` : s.location;
  return s.path?.split("/").filter(Boolean).slice(-1)[0] ?? "";
}

export function historyTitle(s: HistorySession): string {
  if (s.title) return s.title;
  if (s.name) return s.name;
  return s.id;
}

// MatchGroup is one session's matches, as search results show them.
export interface MatchGroup {
  box: string;
  session: HistorySession;
  matches: (HistoryMatch & { box: string })[];
}

export function groupMatches(items: (HistoryMatch & { box: string })[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const m of items) {
    const key = `${m.box}\u0000${m.session.id}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { box: m.box, session: m.session, matches: [] }));
    g.matches.push(m);
  }
  const latest = (s: HistorySession) => s.updated ?? s.started ?? "";
  return [...groups.values()].sort((a, b) => latest(b.session).localeCompare(latest(a.session)));
}

// highlight splits text around what matches q, case-insensitively, for
// marking matches; a bad pattern marks nothing.
export function highlight(text: string, q: string, regexp = false): { text: string; hit: boolean }[] {
  if (!q) return [{ text, hit: false }];
  let re: RegExp;
  try {
    re = new RegExp(regexp ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  } catch {
    return [{ text, hit: false }];
  }
  const out: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m[0] === "") break;
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}

// handoffFrom is a hand-off prompt that starts from one point in a recorded
// session: what was asked, and what came of it up to there.
export function handoffFrom(s: HistorySession, turns: Turn[], at: number): string {
  const upTo = turns.filter((t) => t.n <= at);
  const lastPrompt = [...upTo].reverse().find((t) => t.role === "user");
  const lastReply = [...upTo].reverse().find((t) => t.role === "assistant");
  const parts = [`Pick up from an earlier ${s.agent ? `${s.agent} ` : ""}session (${historyTitle(s)}${s.path ? `, in ${s.path}` : ""}).`];
  if (lastPrompt) parts.push(`It was asked:\n${clip(lastPrompt.text, 1200)}`);
  if (lastReply) parts.push(`Its last reply at that point:\n${clip(lastReply.text, 1200)}`);
  parts.push("Read the git diff first, then carry on from there.");
  return parts.join("\n\n");
}

export function handoffFromLines(s: HistorySession, lines: string[]): string {
  return [
    `Pick up from an earlier ${s.agent ? `${s.agent} ` : ""}session (${historyTitle(s)}${s.path ? `, in ${s.path}` : ""}). Its terminal ended with:`,
    clip(lines.join("\n"), 2400),
    "Read the git diff first, then carry on from there.",
  ].join("\n\n");
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

// around shortens a long line to start a little before its first match, so
// a narrow row still shows it.
export function around(line: string, q: string, regexp = false, lead = 32): string {
  const first = highlight(line, q, regexp).findIndex((p) => p.hit);
  if (first <= 0) return line;
  const at = highlight(line, q, regexp)
    .slice(0, first)
    .reduce((n, p) => n + p.text.length, 0);
  return at > lead ? `…${line.slice(at - lead).trimStart()}` : line;
}
