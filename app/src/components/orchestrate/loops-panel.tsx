import { CheckIcon, ChevronRightIcon, CircleAlertIcon, HandIcon, RepeatIcon, SquareIcon, XIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dismissLoop, isLive, type Loop, useLoops } from "@/lib/loops";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/workspaces";

const phases: Record<Loop["phase"], string> = {
  prompting: "Prompting",
  waiting: "Agent working",
  checking: "Running the check",
};

const outcomes: Record<NonNullable<Loop["outcome"]>, string> = {
  passed: "Passed",
  failed: "Gave up",
  "needs-you": "Needs you",
  exited: "Session ended",
  "timed-out": "Timed out",
  cancelled: "Stopped",
  error: "Stopped",
};

const rounds = (n: number) => `${n} round${n === 1 ? "" : "s"}`;

// What to say under the title. The CLI's messages are kept, worded for
// a panel: no "(s)", no trailing "…" on a finished loop.
function detail(l: Loop): string {
  if (l.outcome === "passed") return `Passed after ${rounds(l.round)}.`;
  if (l.outcome === "failed") return `The check still fails after ${rounds(l.max)}.`;
  if (l.outcome === "cancelled") return `Stopped in round ${l.round}.`;
  return l.message.replace(/ round\(s\)/, l.round === 1 ? " round" : " rounds");
}

// The panel docks above the status bar (26px) with a 12px gap; toasts stack
// above the panel by reading its height from --berth-loops-h.
const STATUS_BAR = 26;
const GAP = 12;

// LoopsPanel stacks running and finished loops in the corner: what each is
// doing, its round, and the last check's output on demand.
export function LoopsPanel() {
  const loops = useLoops((s) => s.loops);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el) {
      root.style.setProperty("--berth-loops-h", "0px");
      return;
    }
    const sync = () => root.style.setProperty("--berth-loops-h", `${el.offsetHeight + GAP}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--berth-loops-h", "0px");
    };
  }, [loops.length]);

  if (!loops.length) return null;
  return (
    <div ref={ref} style={{ bottom: STATUS_BAR + GAP, right: GAP }} className="fixed z-40 flex max-h-[50vh] w-88 flex-col gap-2 overflow-y-auto" role="region" aria-label="Loops">
      {loops.map((l) => (
        <LoopCard key={l.id} loop={l} />
      ))}
    </div>
  );
}

function LoopCard({ loop: l }: { loop: Loop }) {
  const [open, setOpen] = useState(false);
  const live = isLive(l);
  return (
    <div
      className={cn(
        "rounded-xl border bg-popover p-3 text-sm shadow-lg/5",
        l.outcome === "needs-you" && "border-warning/60",
        l.outcome === "passed" && "border-success/40",
        (l.outcome === "failed" || l.outcome === "error" || l.outcome === "exited" || l.outcome === "timed-out") && "border-destructive/40",
      )}
    >
      <div className="flex items-center gap-2">
        <StatusIcon loop={l} />
        <span className="font-medium">{live ? phases[l.phase] : outcomes[l.outcome!]}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          Round {l.round} of {l.max}
        </span>
        {!live && (
          <button type="button" className="ml-auto inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Dismiss" title="Dismiss" onClick={() => dismissLoop(l.id)}>
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 truncate font-mono text-muted-foreground text-xs" title={`${l.session} · ${l.check}`}>
        {l.session} · {l.check}
      </p>
      <p className="mt-1 text-[13px] text-foreground/80">{detail(l)}</p>
      {l.output !== undefined && (
        <>
          <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground" aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronRightIcon className={cn("size-3 transition-transform", open && "rotate-90")} />
            Last check exited {l.exitCode}
          </button>
          {open && <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/72 p-2 font-mono text-[11px] leading-snug">{l.output.trim() || "(no output)"}</pre>}
        </>
      )}
      <div className="mt-2.5 flex items-center gap-1.5">
        <Button size="xs" variant="outline" onClick={() => void focusSession(l.box, l.session)}>
          Open session
        </Button>
        {live && (
          <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => l.cancel()}>
            <SquareIcon />
            Stop loop
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ loop: l }: { loop: Loop }) {
  if (isLive(l)) return <Spinner className="size-3.5" />;
  if (l.outcome === "passed") return <CheckIcon className="size-3.5 text-success" />;
  if (l.outcome === "needs-you") return <HandIcon className="size-3.5 text-warning" />;
  if (l.outcome === "cancelled") return <RepeatIcon className="size-3.5 text-muted-foreground" />;
  return <CircleAlertIcon className="size-3.5 text-destructive" />;
}
