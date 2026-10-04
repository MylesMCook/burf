import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { CrewMember } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { BoatSide } from "@/views/shore/harbour";

// CrewPanel floats in the corner while a session is open: the helpers
// working beside its agent, the subagents it started and Berth's own (an
// attempt, a reviewer, a loop). It folds to a pill, and starts folded when
// the window is too narrow to spare the room.

const KIND = { subagent: "Subagent", attempt: "Attempt", reviewer: "Reviewer", loop: "Loop" };

const elapsed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

export function CrewPanel({ crew }: { crew: CrewMember[] }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 1200);
  const [now, setNow] = useState(Date.now());
  const busy = crew.filter((c) => c.state !== "finished").length;
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);
  if (!crew.length) return null;
  const summary = busy ? `${busy} working` : "All back";

  return (
    <section
      aria-label="Crew"
      className={cn(
        "shore-in absolute right-4 bottom-[18px] z-20 overflow-hidden bg-(--sh-glass) shadow-(--sh-shadow) ring-(--sh-edge) ring-1 backdrop-blur-xl transition-[width,border-radius] duration-300 max-[1239px]:bottom-[88px]",
        open ? "w-[296px] rounded-[18px]" : "w-auto rounded-full",
      )}
    >
      <button
        type="button"
        data-crew-toggle
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn("flex w-full items-center gap-2 text-left outline-none", open ? "h-11 px-3.5" : "h-10 pr-3 pl-2.5")}
      >
        <BoatSide sail={busy > 0} size={20} />
        <span className="font-semibold text-(--sh-ink) text-[13px]">Crew</span>
        <span className={cn("text-[12.5px]", busy ? "text-(--sh-ink-2)" : "text-(--sh-done-ink)")}>{summary}</span>
        <ChevronDownIcon className={cn("ml-auto size-4 text-(--sh-ink-3) transition-transform", !open && "rotate-180")} />
      </button>
      {open && (
        <ul className="border-(--sh-line) border-t px-1.5 py-1.5">
          {crew.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 rounded-xl px-2 py-2">
              <Glyph state={c.state} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-(--sh-ink) text-[13px] leading-5">{c.name.replace(/^Explore:\s*/, "")}</div>
                <div className={cn("truncate text-[12.5px] leading-5", c.state === "finished" ? "text-(--sh-ink-3)" : "text-(--sh-ink-2)")}>{c.doing}</div>
              </div>
              <div className="shrink-0 text-right text-(--sh-ink-3) text-[11.5px] leading-5">
                <div>{KIND[c.kind]}</div>
                <div className="font-mono tabular-nums">{elapsed((c.state === "finished" ? (c.until ?? now) : now) - c.since)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Glyph({ state }: { state: CrewMember["state"] }) {
  if (state === "finished")
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-(--sh-done)" role="img" aria-label="Back">
        <CheckIcon className="size-2.5 text-white" strokeWidth={3.5} />
      </span>
    );
  if (state === "waiting")
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" role="img" aria-label="Needs you">
        <span className="shore-lamp size-2.5 rounded-full bg-(--sh-lamp)" />
      </span>
    );
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" role="img" aria-label="Working">
      <span className="shore-spin size-3 rounded-full border-(--sh-busy) border-[1.75px] border-t-transparent" />
    </span>
  );
}
