import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import type { CrewMember } from "@/lib/transcript";
import { cn } from "@/lib/utils";

// CrewPanel floats in the corner while a session is open: the helpers
// working beside its agent, the subagents it started and Berth's own (an
// attempt, a reviewer, a loop). It folds to a pill.

const KIND = { subagent: "Subagent", attempt: "Attempt", reviewer: "Reviewer", loop: "Loop" };

export function CrewPanel({ crew }: { crew: CrewMember[] }) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(Date.now());
  const busy = crew.filter((c) => c.state !== "finished").length;
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);
  if (!crew.length) return null;

  return (
    <div className="shore-in fixed right-4 bottom-4 z-20 w-72 overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-[0_8px_30px_-10px_rgba(20,40,90,0.35)] backdrop-blur-md">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-10 w-full items-center gap-2 px-3 text-left text-[13px]">
        <CrewMark />
        <span className="font-medium text-slate-800">Crew</span>
        <span className="text-slate-500">
          {busy ? `${busy} working` : "all back"} · {crew.length}
        </span>
        <ChevronDownIcon className={cn("ml-auto size-4 text-slate-400 transition-transform", !open && "rotate-180")} />
      </button>
      {open && (
        <ul className="border-slate-200/70 border-t">
          {crew.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 px-3 py-2 text-[12.5px]">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", c.state === "finished" ? "bg-emerald-500" : c.state === "waiting" ? "shore-lamp bg-amber-400" : "shore-pulse bg-sky-500")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <AgentIcon agent={c.agent} className="size-3" />
                  <span className="truncate font-medium text-slate-800">{c.name}</span>
                </div>
                <div className="truncate text-slate-500">{c.doing}</div>
              </div>
              <div className="shrink-0 text-right text-slate-400">
                <div>{KIND[c.kind]}</div>
                <div className="tabular-nums">{Math.max(0, Math.round((now - c.since) / 1000))}s</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Three small hulls in a row, the crew's mark.
function CrewMark() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" className="text-[#1d2a55]" aria-hidden>
      {[3, 11, 19].map((x) => (
        <path key={x} d={`M${x} 1 C ${x + 2.6} 3 ${x + 3} 6 ${x + 2.8} 9.5 L ${x + 2.4} 13 H ${x - 2.4} L ${x - 2.8} 9.5 C ${x - 3} 6 ${x - 2.6} 3 ${x} 1 Z`} fill="white" stroke="currentColor" strokeWidth="1.2" />
      ))}
    </svg>
  );
}
