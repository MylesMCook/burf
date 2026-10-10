import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ClockIcon, HandIcon, MinusIcon, XIcon } from "lucide-react";

import type { FlowRun } from "@/lib/flows";
import { Tip } from "@/components/tip";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
  },
  s1: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 15%, transparent)",
    "color": "var(--warning-foreground)",
  },
  s2: {
    "width": "10px",
    "height": "10px",
  },
  s3: {
    "backgroundColor": "var(--muted)",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "width": "10px",
    "height": "10px",
  },
  s5: {
    "width": "10px",
    "height": "10px",
    "borderRadius": "999px",
    "borderWidth": "1.5px",
    "borderStyle": "solid",
    "borderColor": "var(--primary)",
    "borderTopColor": "transparent",
  },
  s6: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 15%, transparent)",
    "color": "var(--warning-foreground)",
  },
  s7: {
    "width": "10px",
    "height": "10px",
  },
  s8: {
    "backgroundColor": "color-mix(in oklab, var(--success) 15%, transparent)",
    "color": "var(--success)",
  },
  s9: {
    "width": "10px",
    "height": "10px",
  },
  s10: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 15%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s11: {
    "width": "10px",
    "height": "10px",
  },
  n0: {
    "display": "inline-flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const words: Record<string, string> = {
  running: "Running",
  queued: "Queued: waiting for a slot, or for its flow's run in this worktree",
  waiting_gate: "Waiting for you at a gate",
  paused: "Paused",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
  interrupted: "Interrupted: berthd restarted during the run, before runs resumed",
};

// RunStatus is a run's outcome at a glance, named for screen readers and
// in a tooltip.
export function RunStatus({ status, className }: { status: FlowRun["status"] | string; className?: string }) {
  const box = [sx(paint.n0), className].filter(Boolean).join(" ");
  const mark =
    status === "waiting_gate" ? (
      <span role="img" aria-label={words[status]} className={[box, sx(paint.s1)].filter(Boolean).join(" ")}>
        <HandIcon className={sx(paint.s2)} strokeWidth={3} />
      </span>
    ) : status === "queued" || status === "paused" ? (
      <span role="img" aria-label={words[status]} className={[box, sx(paint.s3)].filter(Boolean).join(" ")}>
        <ClockIcon className={sx(paint.s4)} strokeWidth={3} />
      </span>
    ) : status === "running" ? (
      <span role="img" aria-label={words[status]} className={box}>
        <span className={[sx(paint.s5), "burf-spin"].filter(Boolean).join(" ")} />
      </span>
    ) : status === "interrupted" || status === "cancelled" ? (
      <span role="img" aria-label={words[status]} className={[box, sx(paint.s6)].filter(Boolean).join(" ")}>
        <MinusIcon className={sx(paint.s7)} strokeWidth={3} />
      </span>
    ) : status === "succeeded" ? (
      <span role="img" aria-label={words[status]} className={[box, sx(paint.s8)].filter(Boolean).join(" ")}>
        <CheckIcon className={sx(paint.s9)} strokeWidth={3} />
      </span>
    ) : (
      <span role="img" aria-label={words[status] ?? status} className={[box, sx(paint.s10)].filter(Boolean).join(" ")}>
        <XIcon className={sx(paint.s11)} strokeWidth={3} />
      </span>
    );
  return <Tip label={words[status] ?? status}>{mark}</Tip>;
}

// runTook is how long a run took, or has been going.
export function runTook(r: FlowRun): string {
  const ms = (r.finished ? new Date(r.finished).getTime() : Date.now()) - new Date(r.started).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
