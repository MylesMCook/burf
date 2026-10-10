"use client";

import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { field, mono } from "./surfaces";
import { announced, pct } from "../utils/range";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "100%",
    "maxWidth": "384px",
    "flexDirection": "column",
    "gap": "10px",
  },
  s1: {
    "display": "flex",
    "alignItems": "baseline",
    "justifyContent": "space-between",
  },
  s2: {
    "fontSize": "13.5px",
    "fontWeight": 500,
  },
  s3: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s4: {
    "display": "flex",
    "gap": "2px",
    "borderRadius": "999px",
    "padding": "2px",
  },
  s5: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "999px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "transitionProperty": "background-color, color, scale",
    "transitionDuration": "150ms",
  },
  s6: {
    "transform": {
      ":active": "scale(0.97)",
    },
  },
  s7: {
    "backgroundColor": "var(--background)",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  s8: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 6%, transparent)",
    "height": "3px",
    "width": "100%",
    "overflow": "hidden",
    "borderRadius": "999px",
  },
  s9: {
    "display": "block",
    "height": "100%",
    "borderRadius": "999px",
    "backgroundColor": {
      "default": "light-dark(#3b82f6, #60a5fa)",
    },
    "transitionProperty": "width",
    "transitionDuration": "500ms",
  },
  s10: {
    "color": {
      "default": "color-mix(in oklab, var(--foreground) 45%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 70%, transparent)",
    },
  },
  s11: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const fmt = (n: number) => n.toLocaleString("en-US");

export interface EffortLevel {
  key: string;
  label: string;
  budget: number;
}

export function ReasoningEffort({
  levels,
  selectedKey,
  spent,
  onSelect,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "levels" | "selectedKey" | "spent" | "onSelect"
> & {
  levels: readonly EffortLevel[];
  selectedKey: string;
  spent: number;
  onSelect?: (key: string) => void;
}) {
  const selected = levels.find((level) => level.key === selectedKey);
  const budget = selected?.budget ?? 0;
  const used = pct(spent, budget);

  return (
    <div
      data-slot="reasoning-effort"
      className={[sx(paint.s0), className].filter(Boolean).join(" ")}

      {...props}
    >
      <div className={sx(paint.s1)}>
        <span className={sx(paint.s2)}>Thinking</span>
        <span className={sx(mono, paint.s3)}>
          {fmt(spent)} / {fmt(budget)}
        </span>
      </div>

      <div className={sx(field, paint.s4)}>
        {levels.map((level) => {
          const active = level.key === selectedKey;
          const levelClass = sx(
            paint.s5,
            Boolean(onSelect) && paint.s6,
            active ? paint.s7 : onSelect ? paint.s10 : paint.s11,
          );
          return onSelect ? (
            <button
              key={level.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(level.key)}
              className={levelClass}
            >
              {level.label}
            </button>
          ) : (
            <span
              key={level.key}
              aria-current={active ? "true" : undefined}
              className={levelClass}
            >
              {level.label}
            </span>
          );
        })}
      </div>

      <span
        role="progressbar"
        aria-label="Thinking budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={announced(used)}
        aria-valuetext={`${fmt(spent)} of ${fmt(budget)}`}
        className={sx(paint.s8)}
      >
        <span
          className={sx(paint.s9)}
          style={{ width: `${used}%` }}
        />
      </span>
    </div>
  );
}
