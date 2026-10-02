import type { Location, Session, Stats, Worktree } from "@/lib/api";

// What the app shows for a session: the agent's last reported state ("ready"
// is an agent open with nothing to do yet), "exited" once the program ended,
// or "idle" for a plain shell.
export type SessionState = "ready" | "running" | "waiting" | "finished" | "exited" | "idle";

export const AGENTS = ["claude", "codex", "opencode", "gemini", "pi", "cursor-agent"];

export function agentOf(s: Session): string | undefined {
  if (s.agent) return s.agent;
  const program = s.command?.trim().split(/\s+/)[0]?.split("/").pop();
  return program && AGENTS.includes(program) ? program : undefined;
}

export function sessionState(s: Session, stats?: Stats): SessionState {
  if (s.exited) return "exited";
  if (s.agent_state) return s.agent_state === "idle" ? "ready" : s.agent_state;
  const reported = stats?.agents?.find((a) => a.path === s.dir && a.state !== "running");
  if (reported) return reported.state === "idle" ? "ready" : reported.state;
  return agentOf(s) ? "running" : "idle";
}

export function worktreeSessions(sessions: Session[] | undefined, wt: Worktree): Session[] {
  return (sessions ?? []).filter((s) => s.dir === wt.path);
}

// worktreeOf finds the worktree a session runs in.
export function worktreeOf(locations: Location[] | undefined, s: Session): { location: Location; worktree: Worktree } | undefined {
  for (const location of locations ?? []) {
    for (const worktree of location.worktrees ?? []) {
      if (worktree.path === s.dir) return { location, worktree };
    }
  }
  return undefined;
}

// sessionName is what the app calls a session everywhere it lists one: the
// agent's name, or "Shell", numbered when its worktree has more than one of
// the same ("Claude Code 2", by when they started). Pass sessions (the
// box's) for the number, and locations with place to say where it runs,
// for lists outside the worktree's own tabs: "cal / billing-fix · Codex".
// The raw session id belongs in tooltips and developer surfaces only.
export function sessionName(s: Session, opts: { sessions?: Session[]; locations?: Location[]; place?: boolean } = {}): string {
  const agent = agentOf(s);
  let name = agent ? agentLabel(agent) : "Shell";
  const same = (opts.sessions ?? []).filter((o) => o.dir === s.dir && agentOf(o) === agent && !o.exited);
  if (same.length > 1) {
    const order = same.sort((a, b) => a.created.localeCompare(b.created) || a.name.localeCompare(b.name));
    const n = order.findIndex((o) => o.name === s.name) + 1;
    if (n > 1) name += ` ${n}`;
  }
  if (!opts.place) return name;
  return `${sessionPlace(s, opts.locations)} · ${name}`;
}

// guessSessionName names a session the box doesn't list (it has gone, or
// its box is away) from its id, which berthd makes from where and what it
// runs: "evals-judge-claude-3k9" → "evals-judge · Claude Code". An id that
// doesn't follow that shape comes back as it is.
export function guessSessionName(id: string): string {
  const at = programIn(id);
  if (!at) return id;
  const name = at.prog === "shell" ? "Shell" : agentLabel(at.prog);
  return at.place ? `${at.place} · ${name}` : name;
}

// guessAgent is the agent a session id names, for an icon.
export const guessAgent = (id: string): string | undefined => {
  const prog = programIn(id)?.prog;
  return prog === "shell" ? undefined : prog;
};

function programIn(id: string): { prog: string; place: string } | undefined {
  const parts = id.split("-");
  for (let i = parts.length - 1; i >= 0; i--) {
    const two = parts.slice(i, i + 2).join("-");
    const prog = AGENTS.includes(two) ? two : AGENTS.includes(parts[i]) || parts[i] === "shell" ? parts[i] : undefined;
    if (prog) return { prog, place: parts.slice(0, i).join("-") };
  }
  return undefined;
}

// sessionPlace is where a session runs: "cal" for a main checkout, "cal /
// billing-fix" for a worktree.
export function sessionPlace(s: Session, locations?: Location[]): string {
  const where = worktreeOf(locations, s);
  if (!where) return s.location ?? s.name;
  return where.worktree.main ? where.location.name : `${where.location.name} / ${where.worktree.name}`;
}

// Worktrees are listed main first, then by name.
export function sortedWorktrees(loc: Location): Worktree[] {
  return [...(loc.worktrees ?? [])].sort((a, b) => Number(!!b.main) - Number(!!a.main) || a.name.localeCompare(b.name));
}

const labels: Record<string, string> = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", gemini: "Gemini", pi: "Pi", "cursor-agent": "Cursor Agent", cursor: "Cursor Agent" };

// agentLabel is an agent's product name: "claude" → "Claude Code".
export const agentLabel = (a: string) => labels[a] ?? a.charAt(0).toUpperCase() + a.slice(1);
