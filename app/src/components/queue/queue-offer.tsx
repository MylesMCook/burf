import * as stylex from "@stylexjs/stylex";
import { CloudOffIcon, TriangleAlertIcon } from "lucide-react";

import { type SendFailure, boxOffline } from "@/lib/queue";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontSize": "13px",
  },
  s1: {
    "borderColor": "color-mix(in oklab, var(--info) 24%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 6%, transparent)",
  },
  s2: {
    "borderColor": "color-mix(in oklab, var(--warning) 32%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
  },
  s3: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s4: {
    "color": {
      "default": "light-dark(var(--info-foreground), var(--info))",
    },
  },
  s5: {
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
  },
  s6: {
    "minWidth": "0px",
  },
  s7: {
    "fontWeight": 500,
  },
  s8: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// When a box is away, a send dialog offers to queue the prompt instead of
// only failing: the laptop agent types it in once the box is back.

// offlineOffer is the offer a dialog opens with when the agent already
// knows the box is away, so the person need not wait out a send first.
export const offlineOffer = (box: string): SendFailure | undefined => (boxOffline(box) ? { kind: "offline", message: `${box} is offline.` } : undefined);

// queueLabel is the dialog's main button while an offer stands.
export const queueLabel = (f: SendFailure, box: string) => (f.kind === "offline" ? `Queue for when ${box} is back` : "Queue anyway");

export function QueueOffer({ failure, box, className }: { failure: SendFailure; box: string; className?: string }) {
  const offline = failure.kind === "offline";
  const Icon = offline ? CloudOffIcon : TriangleAlertIcon;
  return (
    <div role="status" className={[sx(paint.s0), offline ? sx(paint.s1) : sx(paint.s2), className].filter(Boolean).join(" ")}>
      <Icon className={[sx(paint.s3), offline ? sx(paint.s4) : sx(paint.s5)].filter(Boolean).join(" ")} />
      <div className={sx(paint.s6)}>
        <p className={sx(paint.s7)}>{failure.message}</p>
        <p className={sx(paint.s8)}>
          {offline
            ? `Burf can keep the prompt on this Mac and type it in when ${box} is back, after the agent's current turn. It's listed under Queued in the status bar.`
            : "Queue it only if you're sure it didn't arrive; otherwise the agent gets it twice."}
        </p>
      </div>
    </div>
  );
}
