import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import type { SceneName } from "@/components/art/scenes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useHomeList, useHomeWidget } from "./env";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "36px",
    "width": "100%",
    "minWidth": "0px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
  },
  s1: {
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":focus-visible": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s2: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingBottom": "4px",
    "textAlign": "center",
  },
  s3: {
    "marginBottom": "2px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "maxWidth": "288px",
    "textWrap": "balance",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "marginTop": "6px",
  },
  s7: {
    "display": "flex",
    "flexDirection": "column",
  },
  s8: {
    "display": "flex",
    "height": "36px",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
  },
  s9: {
    "width": "14px",
    "height": "14px",
  },
  s10: {
    "height": "12px",
  },
  s11: {
    "marginLeft": "auto",
    "height": "12px",
    "width": "32px",
  },
  s12: {
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-sm)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s13: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s15: {
    "color": "var(--success-foreground)",
  },
  s16: {
    "color": "var(--destructive-foreground)",
  },
  s17: {
    "display": "block",
    "height": "4px",
    "width": "100%",
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
  },
  s18: {
    "display": "block",
    "height": "100%",
    "borderRadius": "999px",
  },
  s19: {
    "backgroundColor": "var(--info)",
  },
  s20: {
    "backgroundColor": "var(--warning)",
  },
  s21: {
    "backgroundColor": "var(--destructive)",
  },
  s22: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 40%, transparent)",
  },

  s23: {
    "@container (max-width: 220px)": {
      display: "none",
    },
  },
  s24: {
    backgroundColor: color.info,
  },
  s25: {
    backgroundColor: color.warning,
  },
  s26: {
    backgroundColor: color.destructive,
  },
  s27: {
    backgroundColor: "color-mix(in oklab, var(--foreground) 40%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The pieces Home's widgets are drawn with, shared with plugins through
// @berth/plugin/ui (WidgetRow, WidgetEmpty, WidgetSkeleton), so a plugin's
// widget reads like Burf's own.

// WidgetRow is one line of a widget: 36px, full width, a button when it
// does something.
export function WidgetRow({ children, onClick, className, label }: { children: ReactNode; onClick?: () => void; className?: string; label?: string }) {
  const cls = [[sx(paint.s0), "group/row"].filter(Boolean).join(" "), onClick && sx(paint.s1), className].filter(Boolean).join(" ");
  if (!onClick) return <div className={cls}>{children}</div>;
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

// WidgetEmpty is a widget with nothing to show: what that means, and the
// one thing to do about it. hold keeps the card (an error). An empty list
// does not: the card leaves the grid, and it draws no scene.
export function WidgetEmpty({ scene = "calm", title, hint, action, onAction, compact, hold = false }: { scene?: SceneName; title: string; hint?: ReactNode; action?: string; onAction?: () => void; compact?: boolean; hold?: boolean }) {
  const { preview } = useHomeWidget();
  useHomeList(hold || preview ? "shown" : "empty");
  return (
    <div className={sx(paint.s2)} data-scene={scene} data-compact={compact ? "" : undefined}>
      <p className={sx(paint.s4)}>{title}</p>
      {hint && <p className={sx(paint.s5)}>{hint}</p>}
      {action && onAction && (
        <span className={sx(paint.s6)}><Button size="xs" variant="outline"  onClick={onAction}>
          {action}
        </Button></span>
      )}
    </div>
  );
}

// WidgetSkeleton stands in for rows while they load, at the height they
// will have, so nothing moves when they arrive.
export function WidgetSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={[sx(paint.s7), className].filter(Boolean).join(" ")} role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={sx(paint.s8)}>
          <div className={sx(paint.s9)}><Skeleton  shape="full" /></div>
          <div className={sx(paint.s10)} style={{ width: `${[62, 48, 70, 54, 40, 66, 58, 44][i % 8]}%` }}><Skeleton /></div>
          <div className={sx(paint.s11)}><Skeleton  /></div>
        </div>
      ))}
    </div>
  );
}

// More says how many rows didn't fit.
export function More({ n, label, onClick }: { n: number; label: string; onClick?: () => void }) {
  if (n <= 0) return null;
  const text = `+${n} more ${label}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={sx(paint.s12)}>
      {text}
    </button>
  ) : (
    <p className={sx(paint.s13)}>{text}</p>
  );
}

export function DiffStat({ add, del, className }: { add: number; del: number; className?: string }) {
  return (
    <span className={[sx(paint.s14), className].filter(Boolean).join(" ")}>
      <span className={sx(paint.s15)}>+{compactNumber(add)}</span> <span className={sx(paint.s16)}>−{compactNumber(del)}</span>
    </span>
  );
}

// A thin bar for a share of something (memory used, a plan's limit).
export function Bar({ value, className, tone }: { value: number; className?: string; tone?: "info" | "warning" | "destructive" | "muted" }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const t = tone ?? (v > 0.9 ? "destructive" : v > 0.75 ? "warning" : "info");
  return (
    <span className={[sx(paint.s17), className].filter(Boolean).join(" ")}>
      <span
        className={[sx(paint.s18), { info: sx(paint.s24), warning: sx(paint.s25), destructive: sx(paint.s26), muted: sx(paint.s27) }[t]].filter(Boolean).join(" ")}      style={{ width: `${Math.round(v * 100)}%` }}
      />
    </span>
  );
}

export function compactNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

// Short ago: "4m", "2h", "3d".
export function shortAgo(iso?: string | number): string {
  const t = typeof iso === "number" ? iso : Date.parse(iso ?? "");
  if (!t) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
