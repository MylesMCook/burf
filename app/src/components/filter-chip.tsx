import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";


const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "height": "28px",
    "maxWidth": "176px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "outline": "none",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
    ":not(#\\#) svg": {
      "width": "12px",
      "height": "12px",
      "flexShrink": 0,
    },
  },
  s1: {
    "borderColor": "color-mix(in oklab, var(--foreground) 25%, transparent)",
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// FilterChip narrows a list to the rows that have something: a label, a
// tag, a state. Chips start off, so nothing is narrowed; each one turned
// on narrows further. Issues' labels, Prompts' tags, Worktrees' "Behind
// base" and the live events' types use it.
//
// Choosing which boxes a page covers is BoxFilter (all on to start), and
// picking one of a few values is PickOne.
export function FilterChip({ pressed, onPressedChange, children, className }: { pressed: boolean; onPressedChange(pressed: boolean): void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={[sx(paint.s0), pressed && sx(paint.s1), className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
