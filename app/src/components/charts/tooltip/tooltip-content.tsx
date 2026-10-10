"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { intFmt } from "../chart-formatters";

const paint = stylex.create({
  s0: {
    "overflow": "hidden",
  },
  s1: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s2: {
    "marginBottom": "8px",
    "textAlign": "left",
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "6px",
    },
  },
  s4: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "16px",
  },
  s5: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s6: {
    "height": "10px",
    "width": "10px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s7: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s8: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontVariantNumeric": "tabular-nums",
  },
  s9: {
    "marginTop": "8px",
    "transitionProperty": "opacity",
    "transitionDuration": "200ms",
    "transitionTimingFunction": "cubic-bezier(0, 0, 0.2, 1)",
  },

  s10: {
    color: "var(--chart-tooltip-foreground)",
  },
  s11: {
    color: "var(--chart-tooltip-muted)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface TooltipRow {
  color: string;
  label: string;
  value: string | number;
}

export interface TooltipContentProps {
  title?: string;
  rows: TooltipRow[];
  /** Optional additional content (e.g., markers) */
  children?: ReactNode;
}

export function TooltipContent({ title, rows, children }: TooltipContentProps) {
  return (
    <div className={sx(paint.s0)}>
      <div className={sx(paint.s1)}>
        {title && (
          <div className={[sx(paint.s2), sx(paint.s10)].filter(Boolean).join(" ")}>
            {title}
          </div>
        )}
        <div className={sx(paint.s3)}>
          {rows.map((row) => (
            <div
              className={sx(paint.s4)}
              key={`${row.label}-${row.color}`}
            >
              <div className={sx(paint.s5)}>
                <span
                  className={sx(paint.s6)}
                  style={{ backgroundColor: row.color }}
                />
                <span className={[sx(paint.s7), sx(paint.s11)].filter(Boolean).join(" ")}>
                  {row.label}
                </span>
              </div>
              <span className={[sx(paint.s8), sx(paint.s10)].filter(Boolean).join(" ")}>
                {typeof row.value === "number" ? intFmt(row.value) : row.value}
              </span>
            </div>
          ))}
        </div>

        {children && (
          <div className={sx(paint.s9)}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

TooltipContent.displayName = "TooltipContent";

export default TooltipContent;
