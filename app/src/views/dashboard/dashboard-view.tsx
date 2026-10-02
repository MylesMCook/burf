import { ChevronRightIcon, LayoutDashboardIcon, PlusIcon, TerminalIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type SessionEntry, useAllSessions } from "@/hooks/use-agent-counts";
import { agentOf, type SessionState, worktreeOf } from "@/lib/derive";
import { ago } from "@/lib/format";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/workspaces";
import { AgentCard } from "@/views/dashboard/agent-card";
import { ViewHeader } from "@/views/view-header";

interface Column {
  state: SessionState;
  title: string;
  empty: string;
}

const COLUMNS: Column[] = [
  { state: "waiting", title: "Needs you", empty: "Nothing is waiting on you." },
  { state: "running", title: "Working", empty: "No agent is working." },
  { state: "finished", title: "Done", empty: "Finished turns land here." },
  { state: "ready", title: "Ready", empty: "Agents open with nothing to do." },
];

// Cards in a column: the longest in that state first, so what has waited
// longest is on top.
const sinceOf = (e: SessionEntry) => new Date(e.session.state_since ?? e.session.created).getTime();

// DashboardView is every agent on every box as a board, by what it needs:
// you, time, a look at what it did, or a first prompt.
export function DashboardView() {
  const all = useAllSessions();
  const boxNames = useMemo(() => [...new Set(all.map((e) => e.box))].sort(), [all]);
  const [hidden, setHidden] = useState<string[]>(() => load("berth.dashboard.hiddenBoxes", []));
  const [showRest, setShowRest] = useState(false);
  const shownBoxes = boxNames.filter((b) => !hidden.includes(b));
  const visible = all.filter((e) => !hidden.includes(e.box));
  const rest = visible.filter((e) => !COLUMNS.some((c) => c.state === e.state));
  const agents = all.filter((e) => COLUMNS.some((c) => c.state === e.state));
  const filtered = shownBoxes.length < boxNames.length;

  const setShown = (boxes: string[]) => {
    // Turning every box off means "show everything", not an empty board.
    const next = boxes.length ? boxNames.filter((b) => !boxes.includes(b)) : [];
    setHidden(next);
    save("berth.dashboard.hiddenBoxes", next);
  };

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Agent Dashboard"
        description={filtered ? `Showing ${shownBoxes.join(", ")} only` : "Every agent on every box, by what it needs."}
        actions={
          boxNames.length > 1 && (
            <div className="flex items-center gap-2">
              {filtered && (
                <Button size="xs" variant="ghost" onClick={() => setShown(boxNames)}>
                  Show all
                </Button>
              )}
              <ToggleGroup multiple size="sm" variant="outline" value={shownBoxes} onValueChange={(v) => setShown(v as string[])} aria-label="Boxes to show">
                {boxNames.map((b) => (
                  <ToggleGroupItem key={b} value={b} className="px-2.5 text-muted-foreground text-xs data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs dark:data-pressed:bg-input">
                    {b}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )
        }
      />

      {agents.length === 0 ? (
        <Empty className="mt-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutDashboardIcon />
            </EmptyMedia>
            <EmptyTitle>No agents yet</EmptyTitle>
            <EmptyDescription>Start one in a new worktree, or from any worktree's + menu.</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => useStore.getState().openNewWorktree()}>
            <PlusIcon />
            New worktree
          </Button>
        </Empty>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] items-start gap-x-4 gap-y-6 px-6 pt-4 pb-6">
            {COLUMNS.map((c) => {
              const items = visible.filter((e) => e.state === c.state).sort((a, b) => sinceOf(a) - sinceOf(b));
              return (
                <section key={c.state} aria-label={c.title} className="min-w-0">
                  <header className="mb-2 flex items-center gap-2 px-0.5">
                    <StateGlyph state={c.state} />
                    <h2 className="font-medium text-xs">{c.title}</h2>
                    <span className={cn("ml-auto font-mono text-[11px] tabular-nums", items.length && c.state === "waiting" ? "text-warning" : "text-muted-foreground")}>{items.length}</span>
                  </header>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground/70 text-xs">{c.empty}</p>
                    ) : (
                      items.map((e) => <AgentCard key={`${e.box}/${e.session.name}:${e.state}`} entry={e} />)
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="border-t px-6 py-2">
              <button type="button" aria-expanded={showRest} onClick={() => setShowRest(!showRest)} className="flex items-center gap-1.5 rounded-md py-1 text-muted-foreground text-xs hover:text-foreground">
                <ChevronRightIcon className={cn("size-3 transition-transform", showRest && "rotate-90")} />
                <TerminalIcon className="size-3.5" />
                Shells & exited · {summary(rest)}
              </button>
              {showRest && (
                <div className="mt-2 mb-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                  {rest.map((e) => (
                    <QuietCard key={`${e.box}/${e.session.name}`} entry={e} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// QuietCard is a shell or an exited session: just where it is, one click
// from opening.
function QuietCard({ entry }: { entry: SessionEntry }) {
  const { box, session, state } = entry;
  const locations = useStore((s) => s.boxes[box]?.locations);
  const where = worktreeOf(locations, session);
  return (
    <button type="button" onClick={() => void focusSession(box, session.name)} className="flex items-center gap-2 rounded-lg border bg-card/60 px-2.5 py-1.5 text-left text-xs hover:border-ring/40">
      <AgentIcon agent={agentOf(session)} />
      <span className="min-w-0 flex-1 truncate">{where?.worktree.main ? where.location.name : (where?.worktree.name ?? session.name)}</span>
      <span className="shrink-0 text-muted-foreground">{state === "exited" ? "exited" : `${box} · ${ago(session.created)}`}</span>
    </button>
  );
}

function summary(entries: SessionEntry[]): string {
  const shells = entries.filter((e) => e.state === "idle").length;
  const exited = entries.filter((e) => e.state === "exited").length;
  return [shells && `${shells} shell${shells === 1 ? "" : "s"}`, exited && `${exited} exited`].filter(Boolean).join(", ");
}
