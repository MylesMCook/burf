import { useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { openOrchestrate, SessionActions } from "@/components/orchestrate/session-actions";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import type { SessionEntry } from "@/hooks/use-agent-counts";
import { boxApi } from "@/lib/api";
import { agentOf, worktreeOf } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/workspaces";
import { type Choice, useScreenTail } from "@/views/dashboard/use-screen-tail";

// One clock for every card, so a board of them re-renders once a second at
// most, not once per card.
const listeners = new Set<(n: number) => void>();
let timer = 0;
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    listeners.add(setNow);
    if (!timer) timer = window.setInterval(() => listeners.forEach((l) => l(Date.now())), 1000);
    return () => {
      listeners.delete(setNow);
      if (!listeners.size) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
  }, []);
  return now;
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// AgentCard is one agent on the board: where it works, how long it has been
// in its state, the last thing it said, and what you can do about it.
export function AgentCard({ entry }: { entry: SessionEntry }) {
  const { box, session, state } = entry;
  const locations = useStore((s) => s.boxes[box]?.locations);
  const where = worktreeOf(locations, session);
  const now = useNow();
  // A ready agent has said nothing yet: its screen is only a banner.
  const { tail, choices } = useScreenTail(box, session, 3, state === "running", state !== "ready");
  const since = session.state_since ?? session.created;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const open = () => void focusSession(box, session.name);
  const title = where?.worktree.main ? where.location.name : (where?.worktree.name ?? session.location ?? session.name);
  const asking = state === "waiting" && choices.length > 0;
  // The question, without the options the chips below already show.
  const lines = asking ? (tail ?? []).filter((l) => !/^\s*(?:[❯›>]\s*)?\d[.)]\s/.test(l)) : tail;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && open()}
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-lg border bg-card text-left outline-none transition-[opacity,translate,border-color] duration-200 hover:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring",
        shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        state === "waiting" && "shadow-[inset_2px_0_0_var(--color-warning)]",
      )}
    >
      <div className="px-3 pt-2.5">
        <div className="flex items-center gap-2">
          <AgentIcon agent={agentOf(session)} />
          <span className="min-w-0 flex-1 truncate font-medium text-[13px]">{title}</span>
          <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", state === "waiting" ? "text-warning" : "text-muted-foreground")} title={`Since ${new Date(since).toLocaleString()}`}>
            {duration(now - new Date(since).getTime())}
          </span>
        </div>
        <div className="mt-0.5 truncate pl-5.5 text-[11px] text-muted-foreground">
          {box}
          {where && ` · ${where.location.name}`}
          {where?.worktree.branch && where.worktree.branch !== title && <span className="opacity-70"> · {where.worktree.branch}</span>}
        </div>
        {lines && lines.length > 0 && state !== "ready" && (
          <div className={cn("mt-2 space-y-px rounded-md bg-muted/50 px-2 py-1.5 font-mono text-[11px] leading-snug", state === "waiting" ? "text-foreground/85" : "text-muted-foreground")}>
            {lines.map((l, i) => (
              <div key={i} className="truncate whitespace-pre" title={l}>
                {l}
              </div>
            ))}
          </div>
        )}
        {asking && <Answers box={box} session={session.name} choices={choices} />}
      </div>

      <footer className="mt-2 flex items-center gap-1 border-t px-1.5 py-1">
        <span className="ml-auto flex items-center gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Button size="xs" variant="ghost" className="h-6 text-[11px]" onClick={open}>
            Open
          </Button>
          <Button size="xs" variant="ghost" className="h-6 text-[11px]" onClick={() => openOrchestrate("send", box, session.name)}>
            {state === "ready" ? "Prompt…" : "Reply…"}
          </Button>
          <SessionActions box={box} session={session.name} />
        </span>
      </footer>
    </article>
  );
}

// Answers are the agent's numbered options as buttons: one click types the
// number into its session, which is how Claude Code takes an answer.
function Answers({ box, session, choices }: { box: string; session: string; choices: Choice[] }) {
  const client = useStore((s) => s.client);
  const [sent, setSent] = useState<string>();
  const answer = async (c: Choice) => {
    if (!client) return;
    setSent(c.key);
    try {
      await boxApi.send(client, box, session, c.key, false);
      toastManager.add({ title: `Answered ${c.key}`, description: c.label, type: "success" });
    } catch (err) {
      setSent(undefined);
      toastManager.add({ title: "Couldn't answer", description: errorMessage(err), type: "error" });
    }
  };
  return (
    <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {choices.map((c) => (
        <button
          key={c.key}
          type="button"
          disabled={!!sent}
          onClick={() => void answer(c)}
          title={c.label}
          className={cn(
            "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border bg-background px-2 text-[11px] transition-colors hover:border-ring/50 disabled:opacity-50",
            sent === c.key && "border-success/50 text-success",
          )}
        >
          <span className="font-mono text-muted-foreground">{c.key}</span>
          <span className="truncate">{c.label.length > 28 ? `${c.label.slice(0, 27)}…` : c.label}</span>
        </button>
      ))}
    </div>
  );
}
