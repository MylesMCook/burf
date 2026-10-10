import * as stylex from "@stylexjs/stylex";
import { CornerDownLeftIcon, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { Tip } from "@/components/tip";

const paint = stylex.create({
  s0: {
    "flexShrink": 0,
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s1: {
    "display": "inline-flex",
    "width": "20px",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-sm)",
    "backgroundColor": "#F4EAD5",
  },
  s2: {
    "width": "16px",
    "height": "16px",
  },
  s3: {
    "display": "inline-flex",
    "height": "1.125rem",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "0.3125rem",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontWeight": 500,
    "fontSize": "0.6875rem",
    "lineHeight": "1",
  },
  s4: {
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "borderColor": "color-mix(in oklab, var(--success) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--success) 8%, transparent)",
    "color": "var(--success-foreground)",
  },
  s6: {
    "borderColor": "color-mix(in oklab, var(--warning) 35%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 10%, transparent)",
    "color": "var(--warning-foreground)",
  },
  s7: {
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s8: {
    "width": "12px",
    "height": "12px",
  },
  s9: {
    "display": "flex",
    "minHeight": "32px",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "paddingRight": "4px",
    "paddingLeft": "8px",
  },
  s10: {
    "marginLeft": "2px",
    "minWidth": "0px",
    "flexShrink": 1,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s11: {
    "display": "none",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "marginLeft": "4px",
  },
  s13: {
    "display": "none",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s14: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "paddingLeft": "8px",
    "fontSize": "0.75rem",
    "color": "var(--muted-foreground)",
  },
  s15: {
    "width": "12px",
    "height": "12px",
  },
  s16: {
    "display": "none",
  },
  q17: {
    "display": {
      "@container (min-width: 420px)": {
        "default": "inline",
      },
    },
  },
  q18: {
    "display": {
      "@container (min-width: 520px)": {
        "default": "inline-flex",
      },
    },
  },
  q19: {
    "display": {
      "@container (min-width: 360px)": {
        "default": "inline",
      },
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const Dot = () => (
  <span className={sx(paint.s0)} aria-hidden>
    ·
  </span>
);

// BerthAvatar is Burf's own mark, for its reports.
export function BerthAvatar() {
  return (
    <span aria-hidden className={sx(paint.s1)}>
      <img src={`${import.meta.env.BASE_URL}branding/burf-mark.svg`} alt="" width="16" height="16" className={sx(paint.s2)} />
    </span>
  );
}

export type ChipTone = "plain" | "ask" | "bad" | "lead" | "good";
export interface Chip {
  word: string;
  Icon: LucideIcon;
  tone: ChipTone;
}

export function KindChip({ chip, className }: { chip: Chip; className?: string }) {
  return (
    <span
      data-chip={chip.word}
      className={[sx(paint.s3), chip.tone === "plain" && sx(paint.s4), chip.tone === "good" && sx(paint.s5), chip.tone === "ask" && sx(paint.s6), chip.tone === "bad" && sx(paint.s7), chip.tone === "lead" && "am-c-orange am-chip-tint", className].filter(Boolean).join(" ")}
    >
      <chip.Icon className={sx(paint.s8)} aria-hidden />
      {chip.word}
    </span>
  );
}

// CardHead is the head every card to the agent shares, Burf's reports
// included: avatar, name, what kind of sender, a kind chip, what else it
// says (a diff, a count), the time it took, "to Claude" and Open.
export function CardHead({ avatar, name, kind, chip, extra, took, tip, open }: { avatar: ReactNode; name: string; kind?: string; chip: Chip; extra?: ReactNode; took?: string; tip: string; open?: ReactNode }) {
  return (
    <div className={sx(paint.s9)}>
      {avatar}
      <span className={sx(paint.s10)} data-card-name>
        {name}
      </span>
      {kind && <span className={[sx(paint.s11), sx(paint.q17)].filter(Boolean).join(" ")}>{kind}</span>}
      <KindChip chip={chip} className={sx(paint.s12)} />
      {extra}
      {took && (
        <span className={[sx(paint.s13), sx(paint.q18)].filter(Boolean).join(" ")}>
          <Dot />
          {took}
        </span>
      )}
      <Tip label={tip}>
        <span data-to-agent className={sx(paint.s14)}>
          <CornerDownLeftIcon className={sx(paint.s15)} aria-hidden />
          <span className={[sx(paint.s16), sx(paint.q19)].filter(Boolean).join(" ")}>to Claude</span>
        </span>
      </Tip>
      {open}
    </div>
  );
}
