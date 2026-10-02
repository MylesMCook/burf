import { GitBranchIcon, HomeIcon } from "lucide-react";
import { useMemo } from "react";

import { AgentIcon, StateGlyph, stateText } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import type { Location, Session, Worktree } from "@/lib/api";
import { agentOf, type SessionState, sessionState, worktreeSessions } from "@/lib/derive";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { refOf, selectWorktree, useWorkspaces, wsKey } from "@/lib/workspaces";

// The most a rail lists; the rest are a ⌘K away.
const MAX = 8;

const urgency: Record<SessionState, number> = { waiting: 0, running: 1, finished: 2, ready: 3, idle: 4, exited: 5 };

interface Entry {
  key: string;
  box: string;
  loc: Location;
  wt: Worktree;
  state?: SessionState;
  agent?: string;
  selected: boolean;
}

// RailWorktrees are the active worktrees in the folded sidebar: those with
// a session running and the one open, most urgent first, so switching
// worktree does not need the sidebar back. Each shows its agent and state.
export function RailWorktrees() {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const current = useWorkspaces((s) => s.current);
  const inWorkspace = useStore((s) => s.view.kind === "workspace");

  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const b of boxes) {
      if (b.state !== "online") continue;
      const d = data[b.name];
      for (const loc of d?.locations ?? []) {
        for (const wt of loc.worktrees ?? []) {
          const key = wsKey(b.name, wt.path);
          const live = worktreeSessions(d?.sessions, wt).filter((s) => !s.exited);
          const selected = inWorkspace && current === key;
          if (!live.length && !selected) continue;
          const ranked = live.map((s): [Session, SessionState] => [s, sessionState(s, d?.stats)]).sort((x, y) => urgency[x[1]] - urgency[y[1]]);
          const lead = ranked.find(([s]) => agentOf(s)) ?? ranked[0];
          out.push({ key, box: b.name, loc, wt, state: ranked[0]?.[1], agent: lead && agentOf(lead[0]), selected });
        }
      }
    }
    out.sort((x, y) => urgency[x.state ?? "idle"] - urgency[y.state ?? "idle"] || x.loc.name.localeCompare(y.loc.name) || x.wt.name.localeCompare(y.wt.name));
    return out.slice(0, MAX);
  }, [boxes, data, current, inWorkspace]);

  if (!entries.length) return null;
  return (
    <div className="mt-2 flex flex-col items-center gap-1 border-sidebar-border border-t pt-2">
      {entries.map((e) => {
        const name = e.wt.main ? `${e.loc.name} main checkout` : `${e.loc.name} / ${e.wt.name}`;
        const state = e.state && e.state !== "idle" ? stateText(e.state) : undefined;
        const label = `${name} · ${e.box}${state ? ` · ${state.toLowerCase()}` : ""}`;
        return (
          <Tip key={e.key} label={label} side="right">
            <button
              type="button"
              aria-label={label}
              aria-current={e.selected || undefined}
              onClick={() => selectWorktree(refOf(e.box, e.loc, e.wt))}
              className={cn(
                "relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                e.selected && "bg-sidebar-accent text-foreground",
              )}
            >
              {e.agent ? <AgentIcon agent={e.agent} className="size-4" /> : e.wt.main ? <HomeIcon className="size-4" /> : <GitBranchIcon className="size-4" />}
              {e.state && e.state !== "idle" && (
                <span className="-right-0.5 -bottom-0.5 absolute flex rounded-full bg-sidebar">
                  <StateGlyph state={e.state} />
                </span>
              )}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
