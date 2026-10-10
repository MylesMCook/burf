import * as stylex from "@stylexjs/stylex";
import { ChevronRightIcon, CircleStopIcon, ClockIcon, CoinsIcon, FlaskConicalIcon, GitCompareArrowsIcon, GitPullRequestIcon, HandIcon, RepeatIcon, WebhookIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Scene } from "@/components/art/scenes";
import { BoxFilter, shownBoxes } from "@/components/box-filter";
import { FilterChip } from "@/components/filter-chip";
import { SimpleSelect } from "@/components/simple-select";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { toastManager } from "@/components/ui/toast";
import type { Run, RunStep, RunUsage } from "@/lib/api";
import { ago, errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { ErrorText } from "@/components/error-note";
import { NeedsUpdate } from "@/components/upgrade-box";
import { allRuns, type BoxRun, boxHasRuns, getRun, isActive, runs as runsApi, scheduleRuns, useRuns } from "@/lib/runs";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { CATALOG } from "@/views/automations/catalog";
import { STEP_KINDS } from "@/views/automations/flows/model";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import { RunStatus } from "@/views/automations/flows/run-status";
import type { BoxRun as BoxFlowRun } from "@/views/automations/flows/use-runs";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s1: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
  },
  s2: {
    "width": "224px",
  },
  s3: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s4: {
    "display": "grid",
    "gridTemplateColumns": "20px minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.1fr) 80px 70px",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "textAlign": "right",
  },
  s6: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s7: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
  },
  s8: {
    "width": "12px",
    "height": "12px",
  },
  s9: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "width": "12px",
    "height": "12px",
  },
  s11: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "width": "12px",
    "height": "12px",
  },
  s13: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
  },
  s14: {
    "width": "12px",
    "height": "12px",
  },
  s15: {
    "color": "var(--muted-foreground)",
  },
  s16: {
    "display": "grid",
    "width": "100%",
    "gridTemplateColumns": "20px minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.1fr) 80px 70px",
    "minHeight": "var(--row-h)",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s17: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s18: {
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s19: {
    "transform": "rotate(90deg)",
  },
  s20: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "textAlign": "right",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s26: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "backgroundColor": "color-mix(in oklab, var(--muted) 20%, transparent)",
    "paddingLeft": "48px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 20%, transparent)",
    "paddingLeft": "48px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s28: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 20%, transparent)",
    "paddingLeft": "48px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s29: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 20%, transparent)",
    "paddingLeft": "48px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "12px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s30: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s31: {
    "fontFamily": "var(--font-mono)",
  },
  s32: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s33: {
    "width": "12px",
    "height": "12px",
  },
  s34: {
    "color": "var(--destructive-foreground)",
  },
  s35: {
    "marginLeft": "auto",
  },
  s36: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--warning) 40%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s37: {
    "fontWeight": 500,
  },
  s38: {
    "marginTop": "2px",
    "whiteSpace": "pre-wrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s39: {
    "marginTop": "8px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
  },
  s40: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s41: {
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "paddingLeft": "12px",
  },
  s42: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s43: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s44: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s45: {
    "fontWeight": 500,
  },
  s46: {
    "color": "var(--muted-foreground)",
  },
  s47: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s48: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s49: {
    "position": "relative",
    "display": {
      "default": "none",
      "@media (min-width: 640px)": {
        "default": "block",
      },
    },
    "height": "6px",
    "width": "96px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
  },
  s50: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--primary) 50%, transparent)",
  },
  s51: {
    "color": "var(--muted-foreground)",
  },
  s52: {
    "flexShrink": 0,
  },
  s53: {
    "color": "var(--destructive-foreground)",
  },
  s54: {
    "color": "var(--muted-foreground)",
  },
  s55: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s56: {
    "maxHeight": "192px",
    "overflow": "auto",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.375",
  },
  n0: {
    "flexShrink": 0,
  },
  n1: {
    "color": "var(--destructive-foreground)",
  },
  n2: {
    "color": "var(--success)",
  },
  n3: {
    "color": "var(--muted-foreground)",
  },

  s57: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s58: {
    color: color.mutedForeground,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// RunsTab is every run on every box, newest first: flows' runs, loops,
// attempts, reviews, hand-offs and broadcasts, each a timeline of its steps
// read from the run's journal on the box, with what its agents spent where
// they report it. A run waiting at a gate can be decided here. Boxes from
// before runs show their flows' runs as they always did.

type Kind = "" | "flow" | "loop" | "attempts" | "other";
const KINDS: { value: Kind; label: string }[] = [
  { value: "", label: "All runs" },
  { value: "flow", label: "Flows" },
  { value: "loop", label: "Loops" },
  { value: "attempts", label: "Attempts" },
  { value: "other", label: "Reviews, hand-offs, broadcasts" },
];

const kindOf = (t: string): Kind => (t === "flow" || t === "loop" || t === "attempts" ? t : "other");

export function RunsTab({ runs: legacy, boxes, names }: { runs: BoxFlowRun[]; boxes: string[]; names: (box: string, scope: string, id: string) => string }) {
  const byBox = useRuns((s) => s.byBox);
  const [hidden, setHidden] = useState<string[]>(() => load("berth.runs.hiddenBoxes", []));
  const [kind, setKind] = useState<Kind>("");
  const [failed, setFailed] = useState(false);
  const [needsYou, setNeedsYou] = useState(false);
  const hide = (next: string[]) => {
    setHidden(next);
    save("berth.runs.hiddenBoxes", next);
  };
  useEffect(() => {
    for (const b of boxes) if (boxHasRuns(b)) scheduleRuns(b, 0);
  }, [boxes.join(",")]);

  // Boxes with runs list them all; older boxes their flows' runs.
  const fromRuns = allRuns(byBox).filter((r) => boxes.includes(r.box));
  const old: BoxRun[] = legacy
    .filter((r) => !boxHasRuns(r.box))
    .map((r) => ({ id: r.id, box: r.box, template: "flow", flow_id: r.flow, scope: r.scope, status: r.status, created: r.started, updated: r.finished ?? r.started, finished: r.finished, error: r.error, test: r.test, title: names(r.box, r.scope, r.flow) }));
  const all = [...fromRuns, ...old].sort((a, b) => b.created.localeCompare(a.created));

  if (all.length === 0)
    return (
      <Empty space="12">
        <EmptyHeader>
          <EmptyMedia>
            <Scene name="chart" />
          </EmptyMedia>
          <EmptyTitle>No runs yet</EmptyTitle>
          <EmptyDescription>Flows, loops, attempts, reviews and hand-offs run on your boxes and show up here, step by step, with what their agents spent.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const on = shownBoxes(boxes, hidden);
  const shown = all.filter((r) => on.includes(r.box) && (!kind || kindOf(r.template) === kind) && (!failed || r.status === "failed") && (!needsYou || r.status === "waiting_gate"));
  const filtered = on.length < boxes.length || !!kind || failed || needsYou;
  const waiting = all.filter((r) => r.status === "waiting_gate").length;
  const clear = () => {
    hide([]);
    setKind("");
    setFailed(false);
    setNeedsYou(false);
  };

  return (
    <div className={sx(paint.s0)}>
      <div className={sx(paint.s1)}>
        <div className={sx(paint.s2)}>
          <SimpleSelect size="sm" measure="grow" value={kind} onChange={(v) => setKind(v as Kind)} options={KINDS} />
        </div>
        <Tip label="Runs waiting for you at a gate">
          <FilterChip pressed={needsYou} onPressedChange={setNeedsYou}>
            Needs you{waiting ? ` (${waiting})` : ""}
          </FilterChip>
        </Tip>
        <Tip label="Only runs that failed">
          <FilterChip pressed={failed} onPressedChange={setFailed}>
            Failed
          </FilterChip>
        </Tip>
        {filtered && (
          <Button size="xs" variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        )}
        <BoxFilter align="end" boxes={boxes} hidden={hidden} onChange={hide} />
      </div>
      {shown.length === 0 ? (
        <Empty frame="panel">
          <EmptyHeader>
            <EmptyTitle>No runs match</EmptyTitle>
            <EmptyDescription>None of the {all.length} runs kept passes every filter.</EmptyDescription>
          </EmptyHeader>
          <Button size="sm" variant="outline" onClick={clear}>
            Clear filters
          </Button>
        </Empty>
      ) : (
        <div className={sx(paint.s3)}>
          <div className={sx(paint.s4)}>
            <span />
            <span>Run</span>
            <span>Where</span>
            <span>Started by</span>
            <span>When</span>
            <span className={sx(paint.s5)}>Took</span>
          </div>
          <ol className={[sx(paint.s6), sx(paint.s57)].filter(Boolean).join(" ")}>
            {shown.map((r) => (
              <RunRow key={`${r.box}:${r.id}`} run={r} name={r.template === "flow" && r.flow_id ? names(r.box, r.scope ?? "box", r.flow_id) : (r.title ?? r.template)} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const eventLabel = (type: string) => CATALOG.find((e) => e.on === type)?.label;

const TEMPLATE_LABEL: Record<string, string> = { loop: "Loop", attempts: "Attempts", review: "Review", handoff: "Hand-off", broadcast: "Broadcast", "fix-ci": "Fix CI", "address-review": "Review comments", exec: "Command" };

export function took(r: { created: string; finished?: string }): string {
  const ms = (r.finished ? new Date(r.finished).getTime() : Date.now()) - new Date(r.created).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function tokens(u?: RunUsage): string {
  if (!u) return "";
  const n = (u.input ?? 0) + (u.output ?? 0) + (u.cache_read ?? 0) + (u.cache_write ?? 0);
  const k = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  return [n ? `${k} tokens` : "", u.usd ? `$${u.usd.toFixed(2)}` : ""].filter(Boolean).join(" · ");
}

function startedBy(r: BoxRun) {
  const origin = r.origin ?? "";
  if (r.test)
    return (
      <span className={sx(paint.s7)}>
        <FlaskConicalIcon className={sx(paint.s8)} />
        Test run
      </span>
    );
  if (origin === "schedule" || /^schedule/.test(r.idem_key ?? ""))
    return (
      <span className={sx(paint.s9)}>
        <ClockIcon className={sx(paint.s10)} />
        Scheduled
      </span>
    );
  if ((r.idem_key ?? "").startsWith("github:"))
    return (
      <span className={sx(paint.s11)}>
        <GitPullRequestIcon className={sx(paint.s12)} />
        GitHub
      </span>
    );
  if ((r.idem_key ?? "").startsWith("webhook:"))
    return (
      <span className={sx(paint.s13)}>
        <WebhookIcon className={sx(paint.s14)} />
        Webhook
      </span>
    );
  const who = origin.startsWith("laptop:") ? origin.slice(7) : origin.startsWith("flow:") ? eventLabel(r.template) ?? "Its trigger" : origin || "—";
  return <span className={sx(paint.s15)}>{who}</span>;
}

function RunRow({ run: r, name }: { run: BoxRun; name: string }) {
  const [open, setOpen] = useState(r.status === "waiting_gate");
  const where = r.path?.split("/").pop();
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} className={sx(paint.s16)}>
        <RunStatus status={r.status} />
        <span className={sx(paint.s17)}>
          <ChevronRightIcon className={[sx(paint.s18), open && sx(paint.s19)].filter(Boolean).join(" ")} />
          <span className={sx(paint.s20)}>{name}</span>
          {r.template !== "flow" && (
            <Badge variant="outline" size="sm" muted>
              {TEMPLATE_LABEL[r.template] ?? r.template}
            </Badge>
          )}
          {r.status === "waiting_gate" && (
            <Badge variant="warning" size="sm" >
              <HandIcon />
              Needs you
            </Badge>
          )}
        </span>
        {r.scope && r.scope !== "box" ? <ProjectLabel box={r.box} scope={r.scope} className={sx(paint.s21)} /> : <span className={sx(paint.s22)}>{[r.box, where].filter(Boolean).join(" · ")}</span>}
        <span className={sx(paint.s23)}>{startedBy(r)}</span>
        <Tip label={new Date(r.created).toLocaleString()}>
          <span className={sx(paint.s24)}>{ago(r.created)}</span>
        </Tip>
        <span className={sx(paint.s25)}>{took(r)}</span>
      </button>
      {open && <RunTimeline box={r.box} id={r.id} summary={r} />}
    </li>
  );
}

// RunTimeline is a run's steps as a timeline: each step with its status,
// how long it took on a bar against the run's span, and its output.
export function RunTimeline({ box, id, summary }: { box: string; id: string; summary: BoxRun }) {
  const [run, setRun] = useState<Run>();
  const [error, setError] = useState<string>();
  const legacy = !boxHasRuns(box);
  useEffect(() => {
    if (legacy) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await getRun(box, id);
        if (!stop) setRun(r);
        if (!stop && isActive(r)) setTimeout(tick, 2000);
      } catch (err) {
        if (!stop) setError(plainError(err));
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [box, id, summary.updated]);
  if (legacy)
    return (
      <div className={sx(paint.s26)}>
        {summary.error && <ErrorText text={summary.error} />}
        <NeedsUpdate box={box}>{box} keeps its flows' runs without a timeline.</NeedsUpdate>
      </div>
    );
  if (error) return <ErrorText className={sx(paint.s27)} text={error} />;
  if (!run) return <div className={sx(paint.s28)}>Loading…</div>;
  const t0 = new Date(run.created).getTime();
  const t1 = run.finished ? new Date(run.finished).getTime() : Date.now();
  const span = Math.max(1, t1 - t0);
  const decide = async (approve: boolean, pick?: number) => {
    try {
      await runsApi.decide(box, id, { approve, pick });
      scheduleRuns(box, 0);
      setRun(await getRun(box, id));
    } catch (err) {
      toastManager.add({ type: "error", title: "Couldn't decide the gate", description: errorMessage(err) });
    }
  };
  return (
    <div className={sx(paint.s29)}>
      <div className={sx(paint.s30)}>
        <span className={sx(paint.s31)}>{run.id}</span>
        {run.usage && (
          <span className={sx(paint.s32)}>
            <CoinsIcon className={sx(paint.s33)} />
            {tokens(run.usage)}
          </span>
        )}
        {run.error && <span className={sx(paint.s34)}>{run.error}</span>}
        {isActive(run) && (
          <span className={sx(paint.s35)}><Button
            size="xs"
            variant="ghost"
            
            onClick={() =>
              void runsApi
                .cancel(box, id)
                .then(() => scheduleRuns(box, 0))
                .catch((err) => toastManager.add({ type: "error", title: "Couldn't cancel", description: errorMessage(err) }))
            }>
            <CircleStopIcon />
            Cancel run
          </Button></span>
        )}
      </div>
      {run.gate && (
        <div className={sx(paint.s36)}>
          <p className={sx(paint.s37)}>{run.gate.title}</p>
          {run.gate.text && <p className={sx(paint.s38)}>{run.gate.text}</p>}
          <div className={sx(paint.s39)}>
            {run.gate.pick && (run.candidates?.length ?? 0) > 0 ? (
              <>
                {run.candidates!.map((c) => (
                  <Button key={c.index} size="xs" variant={c.index === run.gate!.default ? "default" : "outline"} onClick={() => void decide(true, c.index)}>
                    Pick {c.index + 1} · {c.agent}
                  </Button>
                ))}
                <Button size="xs" variant="ghost" onClick={() => useStore.getState().setView({ kind: "review", run: { box, id } })}>
                  <GitCompareArrowsIcon />
                  Compare
                </Button>
              </>
            ) : (
              <Button size="xs" onClick={() => void decide(true)}>
                Approve
              </Button>
            )}
            <Button size="xs" variant="ghost" onClick={() => void decide(false)}>
              Reject
            </Button>
          </div>
        </div>
      )}
      <Steps steps={run.steps} t0={t0} span={span} depth={0} />
    </div>
  );
}

const STEP_LABEL: Record<string, string> = {
  loop: "Loop",
  round: "Round",
  map: "Fan out",
  item: "Item",
  join: "Join",
  judge: "Judge",
  gate: "Gate",
  if: "If",
  then: "Then",
  else: "Else",
  sleep: "Sleep",
  check: "Check",
  headless: "Headless agent",
  collect: "Collect",
  handoff: "Handoff packet",
  pr: "Pull request",
  cleanup: "Archive the rest",
};

function Steps({ steps, t0, span, depth }: { steps: RunStep[]; t0: number; span: number; depth: number }) {
  return (
    <div className={[sx(paint.s40), depth > 0 && sx(paint.s41)].filter(Boolean).join(" ")}>
      {steps
        .filter((s) => s.status !== "skipped")
        .map((s) => (
          <Step key={s.path} s={s} t0={t0} span={span} depth={depth} />
        ))}
    </div>
  );
}

function Step({ s, t0, span, depth }: { s: RunStep; t0: number; span: number; depth: number }) {
  const [open, setOpen] = useState(s.status === "failed" || s.status === "waiting");
  const m = STEP_KINDS[s.kind as keyof typeof STEP_KINDS];
  const label = m?.label ?? STEP_LABEL[s.kind] ?? s.id;
  const Icon = m?.Icon ?? (s.kind === "loop" || s.kind === "round" ? RepeatIcon : s.kind === "gate" ? HandIcon : ChevronRightIcon);
  const start = s.started ? new Date(s.started).getTime() - t0 : 0;
  const end = s.ended ? new Date(s.ended).getTime() - t0 : s.status === "running" || s.status === "waiting" ? Date.now() - t0 : start;
  const group = !!s.children?.length;
  return (
    <div className={group ? "" : sx(paint.s42)}>
      <button type="button" className={sx(paint.s43)} onClick={() => setOpen(!open)} disabled={!group && !s.output && !s.error}>
        <Icon className={[sx(paint.s44), m?.tone ?? sx(paint.s58)].filter(Boolean).join(" ")} />
        <span className={sx(paint.s45)}>{s.kind === "round" || s.kind === "item" ? `${label} ${s.id.replace(/^\D+/, "") ? Number(s.id.replace(/^\D+/, "")) + (s.kind === "item" ? 1 : 0) : ""}` : label}</span>
        {s.id && !/^\d+$/.test(s.id) && s.kind !== "round" && s.kind !== "item" && <span className={sx(paint.s46)}>{s.id}</span>}
        {s.output && !group && <span className={sx(paint.s47)}>{s.output.split("\n")[0]}</span>}
        {(group || !s.output) && <span className={sx(paint.s48)} />}
        {s.started && depth < 3 && (
          <span className={sx(paint.s49)} aria-hidden>
            <span className={sx(paint.s50)} style={{ left: `${(start / span) * 100}%`, width: `${Math.max(2, ((end - start) / span) * 100)}%` }} />
          </span>
        )}
        {s.usage && <span className={sx(paint.s51)}>{tokens(s.usage)}</span>}
        <span className={[sx(paint.n0), s.status === "failed" ? sx(paint.n1) : s.status === "succeeded" ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}>{s.status}</span>
        {s.kind === "check" && s.status !== "running" && <span className={sx(paint.s54)}>exit {s.exit_code}</span>}
        {s.duration && <span className={sx(paint.s55)}>{s.duration}</span>}
      </button>
      {open && !group && (s.output || s.error) && <pre className={sx(paint.s56)}>{[s.error, s.output].filter(Boolean).join("\n")}</pre>}
      {open && group && <Steps steps={s.children!} t0={t0} span={span} depth={depth + 1} />}
    </div>
  );
}
