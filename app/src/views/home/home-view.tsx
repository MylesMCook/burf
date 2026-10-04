import { ArrowRightIcon, GitBranchIcon } from "lucide-react";
import { useMemo } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { DitherBand } from "@/components/art/dither-band";
import { HARBOUR, HARBOUR_MUTE, useHarbourLight } from "@/components/art/harbour-art";
import { Scene } from "@/components/art/scenes";
import { TaskComposer } from "@/components/conversation/task-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type SessionEntry, useAllSessions } from "@/hooks/use-agent-counts";
import { agentLabel, agentOf, worktreeOf } from "@/lib/derive";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";
import { focusSession, recentWorktrees, selectWorktree, useWorkspaces } from "@/lib/workspaces";

// HomeView is the workspace before any worktree is open: one composer to
// start work (lib/composer), then the agents that need you, are working, or
// just finished, and the worktrees opened lately. Labs puts the harbour
// across the top, dissolving into the page, with the composer at the seam.
const BAND = "clamp(220px, 50vh, 500px)";

export function HomeView() {
  const labs = usePrefs((p) => p.labs);
  const light = useHarbourLight();
  return (
    <div className="absolute inset-0 overflow-y-auto bg-background">
      <div className="relative min-h-full">
        {labs && (
          <div aria-hidden className="absolute inset-x-0 top-0" style={{ height: BAND }}>
            <DitherBand src={HARBOUR[light]} position={0.42} fade={0.45} mute={HARBOUR_MUTE[light]} className="size-full" />
          </div>
        )}
        <div className="relative mx-auto flex w-full max-w-[640px] flex-col items-center px-6 pb-12" style={{ paddingTop: labs ? `calc(${BAND} - 84px)` : "clamp(48px, 16vh, 160px)" }}>
          {!labs && (
            <div aria-hidden className="mb-2">
              <Scene name="dawn" width={136} />
            </div>
          )}
          <h1 className={cn("mb-4 text-balance text-center font-heading font-semibold text-2xl tracking-tight", labs && "[text-shadow:0_0_6px_var(--background),0_0_16px_var(--background)]")}>What should your agents work on?</h1>
          <TaskComposer autoFocus />
          <AgentList className="mt-10" />
          <Recent className="mt-6" />
        </div>
      </div>
    </div>
  );
}

// Recent is the worktrees opened lately, to go back to.
function Recent({ className }: { className?: string }) {
  const spaces = useWorkspaces((st) => st.spaces);
  const recent = recentWorktrees(spaces);
  if (!recent.length) return null;
  return (
    <section className={cn("w-full", className)}>
      <h2 className="mb-1 px-3 text-muted-foreground text-xs">Recent worktrees</h2>
      {recent.map((w) => (
        <button
          key={`${w.ref.box}:${w.ref.path}`}
          type="button"
          onClick={() => selectWorktree(w.ref)}
          className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GitBranchIcon className="size-3.5 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{w.ref.main ? w.ref.location : `${w.ref.location} / ${w.ref.worktree}`}</span>
          <span className="text-muted-foreground text-xs">{w.ref.box}</span>
        </button>
      ))}
    </section>
  );
}

interface Row {
  key: string;
  box: string;
  session: string;
  agent: string;
  title: string;
  where: string;
  state: "waiting" | "running" | "finished";
  since?: string;
}

const ORDER = { waiting: 0, running: 1, finished: 2 } as const;
const SHOWN = { waiting: 6, running: 4, finished: 3 } as const;

function useRows(all: SessionEntry[]): Row[] {
  const boxes = useStore((s) => s.boxes);
  return useMemo(() => {
    const rows: Row[] = [];
    for (const e of all) {
      const agent = agentOf(e.session);
      if (!agent || (e.state !== "waiting" && e.state !== "running" && e.state !== "finished")) continue;
      const wt = worktreeOf(boxes[e.box]?.locations, e.session);
      rows.push({
        key: `${e.box}/${e.session.name}`,
        box: e.box,
        session: e.session.name,
        agent,
        // Named after its work when it has a title, its worktree after.
        title: e.session.title?.trim() || (wt ? (wt.worktree.main ? wt.location.name : wt.worktree.name) : e.session.name),
        where: [wt ? (e.session.title?.trim() && !wt.worktree.main ? `${wt.location.name} / ${wt.worktree.name}` : wt.location.name) : "", e.box].filter(Boolean).join(" · "),
        state: e.state,
        since: e.session.state_since ?? e.session.created,
      });
    }
    rows.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (b.since ?? "").localeCompare(a.since ?? ""));
    const seen = { waiting: 0, running: 0, finished: 0 };
    return rows.filter((r) => ++seen[r.state] <= SHOWN[r.state]);
  }, [all, boxes]);
}

const HEADINGS = { waiting: "Needs you", running: "Working", finished: "Recently done" } as const;

// AgentList is the short list under the composer: who needs you first, then
// who is working, then what just finished. A row opens its agent.
function AgentList({ className }: { className?: string }) {
  const rows = useRows(useAllSessions());
  if (!rows.length) return null;
  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b py-1 pr-1.5 pl-4">
        <h2 className="font-medium text-sm">Your agents</h2>
        <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => useStore.getState().setView({ kind: "dashboard" })}>
          Dashboard
          <ArrowRightIcon />
        </Button>
      </div>
      <div className="p-1">
        {rows.map((r, i) => (
          <div key={r.key}>
            {(i === 0 || rows[i - 1].state !== r.state) && <p className={cn("px-3 pb-1 text-[11px] text-muted-foreground", i === 0 ? "pt-1.5" : "pt-3")}>{HEADINGS[r.state]}</p>}
            <button
              type="button"
              onClick={() => void focusSession(r.box, r.session)}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StateGlyph state={r.state} />
              <span className="min-w-0 truncate font-medium">{r.title}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-muted-foreground text-xs">
                <AgentIcon agent={r.agent} className="size-3" />
                <span className="truncate">
                  {agentLabel(r.agent)} · {r.where}
                </span>
              </span>
              {r.state === "waiting" ? <Badge variant="warning">Needs you</Badge> : <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{ago(r.since)}</span>}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
