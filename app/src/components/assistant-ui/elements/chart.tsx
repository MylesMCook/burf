"use client";

// Adapted from https://r.assistant-ui.com/elements-chart.json.
// Stock props and behavior are retained; styling uses Burf's theme and controls.

import type { ComponentProps } from "react";
import * as stylex from "@stylexjs/stylex";
import { color, font, radius } from "@/styles/tokens.stylex";
import { paper, mark, withClass } from "./surfaces";
import { clamp, take } from "../utils/range";

const still = "@media (prefers-reduced-motion: reduce)";
const fade = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const styles = stylex.create({
  root: {
    display: "flex",
    width: "100%",
    maxWidth: 384,
    minWidth: 0,
    flexDirection: "column",
    gap: 12,
    borderRadius: radius.sm,
    padding: 16,
    fontFamily: font.sans
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12
  },
  label: {
    color: color.mutedForeground,
    fontSize: 12,
    overflowWrap: "anywhere"
  },
  number: {
    fontVariantNumeric: "tabular-nums",
    fontSize: 12
  },
  muted: {
    color: color.mutedForeground
  },
  good: {
    color: "light-dark(var(--color-emerald-600), var(--color-emerald-400))"
  },
  bad: {
    color: "light-dark(var(--color-red-600), var(--color-red-400))"
  },
  value: {
    fontSize: 24,
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums"
  },
  chart: {
    height: 88,
    width: "100%",
    overflow: "visible"
  },
  baseline: {
    stroke: "color-mix(in oklab, var(--foreground) 8%, transparent)"
  },
  bar: {
    animationName: {
      default: fade,
      [still]: "none"
    },
    animationDuration: "300ms",
    animationFillMode: "both"
  },
  blueFill: {
    fill: "light-dark(var(--color-blue-500), var(--color-blue-400))"
  },
  mutedFill: {
    fill: "color-mix(in oklab, var(--foreground) 25%, transparent)"
  },
  area: {
    fill: "light-dark(color-mix(in oklab, var(--color-blue-500) 12%, transparent), color-mix(in oklab, var(--color-blue-400) 15%, transparent))"
  },
  line: {
    stroke: "light-dark(var(--color-blue-500), var(--color-blue-400))"
  }
});
const sx = (...parts: readonly (false | null | undefined | object)[]) => mark(undefined, ...parts).className;

export type ChartVariant = "area" | "line" | "bars";

const W = 300;
const H = 88;
const PAD = 6;

const scale = (points: readonly number[]) => {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  return (value: number) => H - PAD - ((value - min) / span) * (H - PAD * 2);
};

export function Chart({
  label,
  value,
  delta,
  points,
  visibleCount,
  variant = "area",
  trend,
  upIsGood = true,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  | "children"
  | "label"
  | "value"
  | "delta"
  | "points"
  | "visibleCount"
  | "variant"
  | "trend"
  | "upIsGood"
> & {
  label: string;
  value: string;
  delta?: string | undefined;
  points: readonly number[];
  visibleCount: number;
  variant?: ChartVariant | undefined;
  /** The direction `delta` moved in. Without it, a leading minus sign reads as down. */
  trend?: "up" | "down" | "flat" | undefined;
  /** Whether a rise is good news, as for revenue, or bad news, as for latency. */
  upIsGood?: boolean | undefined;
}) {
  const shown = take(points, clamp(visibleCount, 1, points.length));
  const y = scale(points);
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const x = (i: number) => PAD + i * step;

  const coords = shown.map((p, i) => ({ x: x(i), y: y(p) }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const last = coords.at(-1);
  const area = last
    ? `M ${PAD},${H - PAD} ${coords.map((c) => `L ${c.x},${c.y}`).join(" ")} L ${last.x},${H - PAD} Z`
    : "";
  const lastIndex = shown.length - 1;
  const direction =
    trend ??
    (delta === undefined
      ? undefined
      : /\d/.test(delta) && !/[1-9]/.test(delta)
        ? "flat"
        : /^\s*[-−–]/.test(delta)
          ? "down"
          : "up");
  const good =
    direction === "up" || direction === "down"
      ? (direction === "up") === upIsGood
      : undefined;

  return (
    <div
      data-slot="chart"
      className={withClass(undefined, className, paper,
        styles.root,
      ).className}

      {...props}
    >
      <div className={sx(styles.header)}>
        <span className={sx(styles.label)}>{label}</span>
        {delta !== undefined && (
          <span
            data-trend={direction}
            className={sx(
              styles.number,
              good === undefined
                ? styles.muted
                : good
                  ? styles.good
                  : styles.bad,
            )}
          >
            {delta}
          </span>
        )}
      </div>

      <span className={sx(styles.value)}>
        {value}
      </span>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${value}`}
        className={sx(styles.chart)}
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          x2={W}
          y1={H - PAD}
          y2={H - PAD}
          className={sx(styles.baseline)}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {variant === "bars" ? (
          shown.map((p, i) => {
            const top = y(p);
            const barWidth = Math.max(2, step * 0.55);
            return (
              <rect
                key={i}
                x={x(i) - barWidth / 2}
                y={top}
                width={barWidth}
                height={Math.max(1, H - PAD - top)}
                rx="1.5"
                className={sx(
                  styles.bar,
                  i === lastIndex
                    ? styles.blueFill
                    : styles.mutedFill,
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              />
            );
          })
        ) : (
          <>
            {variant === "area" && shown.length > 1 && (
              <path
                d={area}
                className={sx(styles.area)}
              />
            )}
            <polyline
              points={line}
              fill="none"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={sx(styles.line)}
            />
            {last && (
              <circle
                cx={last.x}
                cy={last.y}
                r="3"
                className={sx(styles.blueFill)}
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
}
