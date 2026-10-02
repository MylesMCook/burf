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

export function sessionTitle(s: Session, locations?: Location[]): string {
  const where = worktreeOf(locations, s);
  const place = where?.worktree.branch ?? where?.worktree.name ?? s.location ?? s.name;
  return `${place} · ${agentOf(s) ?? "shell"}`;
}

// Worktrees are listed main first, then by name.
export function sortedWorktrees(loc: Location): Worktree[] {
  return [...(loc.worktrees ?? [])].sort((a, b) => Number(!!b.main) - Number(!!a.main) || a.name.localeCompare(b.name));
}

const labels: Record<string, string> = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", gemini: "Gemini", pi: "Pi", "cursor-agent": "Cursor Agent", cursor: "Cursor Agent" };

// agentLabel is an agent's product name: "claude" → "Claude Code".
export const agentLabel = (a: string) => labels[a] ?? a.charAt(0).toUpperCase() + a.slice(1);
