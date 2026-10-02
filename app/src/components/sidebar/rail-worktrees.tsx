import { useMemo } from "react";

import { stateText } from "@/components/agent-glyph";
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

// monogram is a worktree's two letters on the rail: "billing-fix" is BF,
// "qa" is QA, a main checkout is its project's.
export function monogram(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter((w) => w && !/^\d+$/.test(w));
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2);
  return letters.toUpperCase();
}

// What a rail tile's corner dot says; ready and idle say nothing.
const dot: Partial<Record<SessionState, string>> = {
  waiting: "bg-warning",
  running: "bg-info animate-pulse",
  finished: "bg-success",
};

// RailWorktrees are the active worktrees in the folded sidebar: those with
// a session running and the one open, most urgent first, so switching
// worktree does not need the sidebar back. Each is a lettered tile, with a
// dot in its corner when an agent there is working, waiting or done.
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
    <div className="mt-2 flex flex-col items-center gap-1.5 border-sidebar-border border-t pt-2.5">
      {entries.map((e) => {
        const name = e.wt.main ? `${e.loc.name} main checkout` : `${e.loc.name} / ${e.wt.name}`;
        const state = e.state && e.state !== "idle" ? stateText(e.state) : undefined;
        const label = `${name} · ${e.box}${state ? ` · ${state.toLowerCase()}` : ""}`;
        const mark = e.state && dot[e.state];
        return (
          <Tip key={e.key} label={label} side="right">
            <button
              type="button"
              aria-label={label}
              aria-current={e.selected || undefined}
              onClick={() => selectWorktree(refOf(e.box, e.loc, e.wt))}
              className={cn(
                "relative inline-flex size-8 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/40 font-medium text-[11px] text-muted-foreground tracking-wide outline-none hover:border-ring/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                e.selected && "border-foreground/25 bg-sidebar-accent text-foreground",
              )}
            >
              {monogram(e.wt.main ? e.loc.name : e.wt.name)}
              {mark && <span className={cn("absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-sidebar", mark)} />}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
