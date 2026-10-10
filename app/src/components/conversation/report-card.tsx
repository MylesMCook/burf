import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ChevronDownIcon, CircleDotIcon, CircleStopIcon, CircleXIcon, MilestoneIcon } from "lucide-react";
import { useState } from "react";

import { BerthAvatar, CardHead, type Chip } from "@/components/conversation/agent-message";
import type { BerthReport, TranscriptItem } from "@/lib/transcript";

const paint = stylex.create({
  s0: {
    "flexShrink": 0,
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s1: {
    "display": "flex",
    "width": "min(100%,40rem)",
    "minWidth": "0px",
    "flexDirection": "column",
    "alignSelf": "flex-start",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "fontSize": "0.8125rem",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s2: {
    "borderColor": "color-mix(in oklab, var(--warning) 45%, transparent)",
  },
  s3: {
    "borderColor": "color-mix(in oklab, var(--destructive) 35%, transparent)",
  },
  s4: {
    "flexShrink": 0,
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "color": "var(--success-foreground)",
  },
  s6: {
    "color": "var(--destructive-foreground)",
  },
  s7: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
    "alignItems": "flex-start",
    "gap": "6px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "textAlign": "left",
    "color": "var(--muted-foreground)",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s8: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
    "lineHeight": "1.375",
  },
  s9: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
  },
  s10: {
    "marginTop": "2px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "opacity": 0,
    ":is(.group:hover &)": {
      "opacity": 0.7,
    },
    ":is(.group:focus-visible &)": {
      "opacity": 0.7,
    },
  },
  s11: {
    "transform": "rotate(180deg)",
  },
  q12: {
    "transitionProperty": "transform,opacity",
    "transitionDuration": "150ms",
  },
  q13: {
    "containerType": "inline-size",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A report is Burf telling this agent that work it started has ended,
// needs a person, or reached a gate: what the box typed into the session as
// a <berth-notification> (internal/box/notify_text.go). It reads as a
// compact card, "checkout-fix finished · +12 −2 · 4m12s", with the other
// agent's last words under it and a way to open that agent, never as the
// tagged text, and never as if the person had typed it.

type Tone = "done" | "needs" | "failed" | "ended";

const WORDS: Record<string, [string, Tone]> = {
  finished: ["finished", "done"],
  succeeded: ["succeeded", "done"],
  failed: ["failed", "failed"],
  exited: ["exited", "ended"],
  lost: ["never started", "failed"],
  waiting: ["needs you", "needs"],
  waiting_gate: ["waits at a gate", "needs"],
  cancelled: ["was cancelled", "ended"],
  interrupted: ["was interrupted", "ended"],
};

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

// name is what the report is about, as the person knows it: the worktree,
// else the session, else the run.
export function reportName(r: BerthReport): string {
  if (r.kind === "run") return r.title || r.template || r.run || "A run";
  const wt = r.worktree?.split("/").pop();
  return wt || r.session || "An agent";
}

export function reportWord(r: BerthReport): string {
  if (r.kind !== "run" && r.status === "failed") return "ended on an error";
  return WORDS[r.status]?.[0] ?? r.status.replace(/_/g, " ");
}

// The chip each status gets: the same family as an agent's message
// (agent-message), so Burf's reports and other agents' read as one kind.
const CHIP: Record<Tone, Chip> = {
  done: { word: "Finished", Icon: CheckIcon, tone: "good" },
  needs: { word: "Needs you", Icon: CircleDotIcon, tone: "ask" },
  failed: { word: "Failed", Icon: CircleXIcon, tone: "bad" },
  ended: { word: "Ended", Icon: CircleStopIcon, tone: "plain" },
};

const Dot = () => (
  <span className={sx(paint.s0)} aria-hidden>
    ·
  </span>
);

export function ReportCard({ it }: { it: Extract<TranscriptItem, { kind: "report" }> }) {
  const r = it.report;
  const [open, setOpen] = useState(false);
  const tone = WORDS[r.status]?.[1] ?? "ended";
  const name = reportName(r);
  const word = reportWord(r);
  const detail = (tone === "needs" ? r.needs || r.answer : r.answer || r.needs)?.trim();
  const changed = (r.added ?? 0) + (r.removed ?? 0) > 0;
  const about = r.kind === "run" ? `run ${r.run}` : (r.session ?? name);
  return (
    <div
      data-report={r.status}
      role="group"
      aria-label={`Burf: ${name} ${word}`}
      className={[[sx(paint.s1), [sx(paint.q13), "cv-in"].filter(Boolean).join(" ")].filter(Boolean).join(" "), tone === "needs" && sx(paint.s2), tone === "failed" && sx(paint.s3)].filter(Boolean).join(" ")}
    >
      <CardHead
        avatar={<BerthAvatar />}
        name={name}
        kind={r.kind === "run" ? "Run" : "Agent"}
        chip={r.status === "waiting_gate" ? { word: "At a gate", Icon: MilestoneIcon, tone: "ask" } : { ...CHIP[tone], word: r.kind === "run" || tone !== "done" ? cap(word) : CHIP[tone].word }}
        extra={
          changed && (
            <>
              <Dot />
              <span className={sx(paint.s4)} aria-label={`${r.added ?? 0} lines added, ${r.removed ?? 0} removed`}>
                <span className={sx(paint.s5)}>+{r.added ?? 0}</span> <span className={sx(paint.s6)}>−{r.removed ?? 0}</span>
              </span>
            </>
          )
        }
        took={r.duration}
        tip={`Burf reported back on ${about}, which this agent started, and sent it to the agent. You didn't type it.`}
      />
      {detail && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={[sx(paint.s7), "group"].filter(Boolean).join(" ")}
        >
          <span data-selectable className={[sx(paint.s8), !open && sx(paint.s9)].filter(Boolean).join(" ")}>
            {detail}
          </span>
          <ChevronDownIcon className={[[sx(paint.s10), sx(paint.q12)].filter(Boolean).join(" "), open && sx(paint.s11)].filter(Boolean).join(" ")} aria-hidden />
        </button>
      )}
    </div>
  );
}
