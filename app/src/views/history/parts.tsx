import { FileTextIcon, ServerIcon, SquareTerminalIcon } from "lucide-react";

import { AgentIcon } from "@/components/agent-glyph";
import { agentLabel } from "@/lib/derive";
import { highlight, type HistorySession, historyWhere } from "@/lib/history";
import { cn } from "@/lib/utils";

// Marked shows text with what matches q marked.
export function Marked({ text, q, regexp, className }: { text: string; q?: string; regexp?: boolean; className?: string }) {
  if (!q) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {highlight(text, q, regexp).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[3px] bg-warning/30 px-px text-foreground dark:bg-warning/35">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

export function Chip({ children, title, className }: { children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={cn("inline-flex min-w-0 max-w-56 items-center gap-1 rounded-md border px-1.5 py-px text-[11px] text-muted-foreground [&_svg]:size-3 [&_svg]:shrink-0", className)}>
      {children}
    </span>
  );
}

// Chips are where a recorded session ran: its box, project and branch.
export function SessionChips({ box, s }: { box: string; s: HistorySession }) {
  const where = historyWhere(s);
  return (
    <>
      <Chip title="Box">
        <ServerIcon />
        <span className="truncate">{box}</span>
      </Chip>
      {where && (
        <Chip title={s.path}>
          <span className="truncate">{where}</span>
        </Chip>
      )}
      {s.branch && (
        <Chip title="Branch" className="font-mono">
          <span className="truncate">{s.branch}</span>
        </Chip>
      )}
    </>
  );
}

// SourceIcon is the session's agent, or what kind of record it is.
export function SourceIcon({ s, className }: { s: HistorySession; className?: string }) {
  if (s.agent) return <AgentIcon agent={s.agent} className={className} />;
  return s.source === "claude" ? <FileTextIcon className={cn("size-3.5 text-muted-foreground", className)} /> : <SquareTerminalIcon className={cn("size-3.5 text-muted-foreground", className)} />;
}

export type Liveness = "live" | "waiting" | "finished" | "ended";

export function liveness(s: HistorySession): Liveness {
  if (!s.running) return "ended";
  if (s.state === "waiting") return "waiting";
  if (s.state === "finished" || s.state === "idle") return "finished";
  return "live";
}

const stateText: Record<Liveness, string> = { live: "Running", waiting: "Waiting", finished: "Finished", ended: "Ended" };
const stateDot: Record<Liveness, string> = { live: "bg-info", waiting: "bg-warning", finished: "bg-success", ended: "bg-muted-foreground/40" };

export function StatePill({ s }: { s: HistorySession }) {
  const l = liveness(s);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", stateDot[l])} />
      {stateText[l]}
    </span>
  );
}

export function kindLabel(s: HistorySession): string {
  if (s.source === "claude") return "Claude transcript";
  return s.agent ? `${agentLabel(s.agent)} terminal` : "Terminal";
}

export function clock(iso?: string, withDay = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString(undefined, withDay || !today ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
