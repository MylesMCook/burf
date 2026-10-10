import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CircleAlertIcon, HandIcon, RepeatIcon, CircleStopIcon, XIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSessionName } from "@/hooks/use-session-name";
import { dismissLoop, isLive, type Loop, useLoops } from "@/lib/loops";
import { allRuns, type BoxRun, dismissRun, runs as runsApi, useRuns } from "@/lib/runs";
import { load, save } from "@/lib/storage";
import { focusSession } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "position": "fixed",
    "zIndex": 40,
  },
  s1: {
    "borderRadius": "999px",
    "backgroundColor": "var(--popover)",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s2: {
    "position": "fixed",
    "zIndex": 40,
    "display": "flex",
    "maxHeight": "50vh",
    "width": "352px",
    "flexDirection": "column",
    "gap": "8px",
    "overflowY": "auto",
  },
  s3: {
    "alignSelf": "flex-end",
    "backgroundColor": "color-mix(in oklab, var(--popover) 80%, transparent)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s4: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "padding": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s5: {
    "borderColor": "color-mix(in oklab, var(--warning) 60%, transparent)",
  },
  s6: {
    "borderColor": "color-mix(in oklab, var(--success) 40%, transparent)",
  },
  s7: {
    "borderColor": "color-mix(in oklab, var(--destructive) 40%, transparent)",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s9: {
    "fontWeight": 500,
  },
  s10: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s13: {
    "width": "14px",
    "height": "14px",
  },
  s14: {
    "marginTop": "4px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "fontFamily": "var(--font-mono)",
  },
  s16: {
    "marginTop": "4px",
    "fontSize": "13px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s17: {
    "marginTop": "6px",
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s19: {
    "transform": "rotate(90deg)",
  },
  s20: {
    "marginTop": "6px",
    "maxHeight": "160px",
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 72%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "lineHeight": "1.375",
  },
  s21: {
    "marginTop": "10px",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s22: {
    "width": "14px",
    "height": "14px",
    "color": "var(--success)",
  },
  s23: {
    "width": "14px",
    "height": "14px",
    "color": "var(--warning)",
  },
  s24: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s25: {
    "width": "14px",
    "height": "14px",
    "color": "var(--destructive)",
  },

  s26: {
    backdropFilter: "blur(4px)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

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

// The panel docks above the status bar (26px) with a 12px gap, left of the
// Files panel when that is docked (--berth-dock-w); toasts stack above the
// panel by reading its height from --berth-loops-h.
const STATUS_BAR = 26;
const GAP = 12;

// LoopsPanel stacks running and finished loops in the corner: what each is
// doing, its round, and the last check's output on demand. Loops are the
// window's; an agent's crew is its conversation's (CrewCard, docked above
// its reply box). With no loops the panel is gone and reserves no room.
export function LoopsPanel() {
  const local = useLoops((s) => s.loops);
  const byBox = useRuns((s) => s.byBox);
  const dismissed = useRuns((s) => s.dismissed);
  // Loops that run on boxes, from the boxes' runs: started here, from the
  // CLI, a plugin, another device, or before the app last quit.
  const tracked = new Set(local.map((l) => l.runId).filter(Boolean));
  const fromRuns = allRuns(byBox)
    .filter((r) => r.template === "loop" && !tracked.has(r.id) && !dismissed.includes(`${r.box}/${r.id}`))
    .filter((r) => !r.finished || Date.now() - new Date(r.finished).getTime() < 30 * 60_000)
    .map(loopOfRun);
  const loops = [...local, ...fromRuns];
  const [folded, setFoldedState] = useState(() => load("berth.loops.folded", false));
  const setFolded = (f: boolean) => {
    setFoldedState(f);
    save("berth.loops.folded", f);
  };
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el) {
      root.style.setProperty("--berth-loops-h", "0px");
      root.style.setProperty("--berth-loops-w", "0px");
      return;
    }
    // Its width too, so a centred column (a conversation) can step aside.
    const sync = () => {
      root.style.setProperty("--berth-loops-h", `${el.offsetHeight + GAP}px`);
      root.style.setProperty("--berth-loops-w", `${el.offsetWidth + GAP * 2}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--berth-loops-h", "0px");
      root.style.setProperty("--berth-loops-w", "0px");
    };
  }, [loops.length, folded]);

  if (!loops.length) return null;
  const live = loops.filter(isLive).length;
  const bottom = `calc(var(--berth-status-h, ${STATUS_BAR}px) + ${GAP}px)`;
  // Folded, the panel is one pill in the corner, so it never sits over a
  // page's own controls; it opens again on a click, or when a loop needs you.
  if (folded && !loops.some((l) => l.outcome === "needs-you")) {
    return (
      <div ref={ref} style={{ bottom, right: `calc(${GAP}px + var(--berth-dock-w, 0px))` }} className={sx(paint.s0)} role="region" aria-label="Loops">
        <span className={sx(paint.s1)}><Button size="sm" variant="outline"  onClick={() => setFolded(false)} aria-expanded={false}>
          {live ? <Spinner  size="md"/> : <RepeatIcon />}
          {`${loops.length} loop${loops.length === 1 ? "" : "s"}${live ? ` · ${live} running` : ""}`}
          <ChevronUpIcon />
        </Button></span>
      </div>
    );
  }
  return (
    <div ref={ref} style={{ bottom, right: `calc(${GAP}px + var(--berth-dock-w, 0px))` }} className={sx(paint.s2)} role="region" aria-label="Loops">
      {loops.map((l) => (
        <LoopCard key={l.id} loop={l} />
      ))}
      <span className={[sx(paint.s3), sx(paint.s26)].filter(Boolean).join(" ")}><Button size="xs" variant="ghost"  onClick={() => setFolded(true)} aria-expanded muted>
        <ChevronDownIcon />
        Fold
      </Button></span>
    </div>
  );
}

// loopOfRun shows a loop run as the panel shows a loop. Its round and
// phase come from where the run is (the loop template's step paths).
function loopOfRun(r: BoxRun): Loop {
  const cursor = r.cursor ?? "";
  const round = Number(/\.r(\d+)\./.exec(`${cursor}.`)?.[1] ?? 1);
  const phase: Loop["phase"] = /\.r\d+\.0$/.test(cursor) ? "checking" : /\.t\.1$/.test(cursor) ? "waiting" : "prompting";
  const err = r.error ?? "";
  const outcome: Loop["outcome"] =
    r.status === "succeeded"
      ? "passed"
      : r.status === "cancelled"
        ? "cancelled"
        : r.status === "failed" || r.status === "interrupted"
          ? /waiting for you/.test(err)
            ? "needs-you"
            : /still not done/.test(err)
              ? "failed"
              : /did not finish/.test(err)
                ? "timed-out"
                : /exited/.test(err)
                  ? "exited"
                  : "error"
          : undefined;
  return {
    id: `run:${r.box}:${r.id}`,
    box: r.box,
    session: r.session ?? "",
    check: /^Loop until (.*) passes$/.exec(r.title ?? "")?.[1] ?? r.title ?? "",
    round,
    max: 0,
    phase,
    outcome,
    message: outcome === "passed" ? `Passed after ${round} round(s).` : err || (r.gate ? `Waiting at a gate: ${r.gate.title}` : `Round ${round}`),
    started: new Date(r.created).getTime(),
    ended: r.finished ? new Date(r.finished).getTime() : undefined,
    runId: r.id,
    cancel: () => void runsApi.cancel(r.box, r.id),
  };
}

function LoopCard({ loop: l }: { loop: Loop }) {
  const [open, setOpen] = useState(false);
  const live = isLive(l);
  const name = useSessionName(l.box, l.session, true);
  // The runner's messages name the session by its id, as the CLI does; the
  // panel says what the app calls it.
  const agent = useSessionName(l.box, l.session);
  const said = detail(l).split(l.session).join(agent);
  return (
    <div
      className={[sx(paint.s4), l.outcome === "needs-you" && sx(paint.s5), l.outcome === "passed" && sx(paint.s6), (l.outcome === "failed" || l.outcome === "error" || l.outcome === "exited" || l.outcome === "timed-out") && sx(paint.s7)].filter(Boolean).join(" ")}
    >
      <div className={sx(paint.s8)}>
        <StatusIcon loop={l} />
        <span className={sx(paint.s9)}>{live ? phases[l.phase] : outcomes[l.outcome!]}</span>
        <span className={sx(paint.s10)}>
          Round {l.round}
          {l.max > 0 && ` of ${l.max}`}
        </span>
        {l.runId && (
          <Tip label={`Runs on ${l.box} (${l.runId}): it keeps going if the app quits`}>
            <span className={sx(paint.s11)}>on {l.box}</span>
          </Tip>
        )}
        {!live && (
          <Tip label="Dismiss">
            <button type="button" className={sx(paint.s12)} aria-label="Dismiss"
              onClick={() => {
                dismissLoop(l.id);
                if (l.runId) dismissRun(l.box, l.runId);
              }}
            >
              <XIcon className={sx(paint.s13)} />
            </button>
          </Tip>
        )}
      </div>
      <Tip label={`Session ${l.session} on ${l.box}`} align="start">
        <p className={sx(paint.s14)}>
          {name} · <span className={sx(paint.s15)}>{l.check}</span>
        </p>
      </Tip>
      <p className={sx(paint.s16)}>{said}</p>
      {l.output !== undefined && (
        <>
          <button type="button" className={sx(paint.s17)} aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronRightIcon className={[sx(paint.s18), open && sx(paint.s19)].filter(Boolean).join(" ")} />
            Last check exited {l.exitCode}
          </button>
          {open && <pre className={sx(paint.s20)}>{l.output.trim() || "(no output)"}</pre>}
        </>
      )}
      <div className={sx(paint.s21)}>
        <Button size="xs" variant="outline" onClick={() => void focusSession(l.box, l.session)}>
          Open session
        </Button>
        {live && (
          <Button size="xs" variant="ghost"  onClick={() => l.cancel()} muted>
            <CircleStopIcon />
            Stop loop
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ loop: l }: { loop: Loop }) {
  if (isLive(l)) return <Spinner  size="md"/>;
  if (l.outcome === "passed") return <CheckIcon className={sx(paint.s22)} />;
  if (l.outcome === "needs-you") return <HandIcon className={sx(paint.s23)} />;
  if (l.outcome === "cancelled") return <RepeatIcon className={sx(paint.s24)} />;
  return <CircleAlertIcon className={sx(paint.s25)} />;
}
