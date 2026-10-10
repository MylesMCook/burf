"use client";

import type { ComponentProps } from "react";

import { mark, mono, pulse, riseIn, ShimmerLabel } from "./surfaces";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    lineHeight: "20px",
    color: "color-mix(in oklab, var(--foreground) 55%, transparent)",
  },
  dot: {
    width: 6,
    height: 6,
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: "light-dark(var(--color-blue-500), var(--color-blue-400))",
  },
  time: {
    color: "color-mix(in oklab, var(--foreground) 30%, transparent)",
    fontVariantNumeric: "tabular-nums",
  },
});

export function ThinkingIndicator({
  label,
  elapsed,
  ...props
}: Omit<ComponentProps<"div">, "children" | "label" | "elapsed" | "className" | "style"> & {
  label: string;
  elapsed?: string;
}) {
  return (
    <div data-slot="thinking-indicator" {...mark(undefined, styles.row)} {...props}>
      <span aria-hidden {...mark(undefined, styles.dot, pulse)} />
      <span {...mark(undefined, riseIn)}>
        <ShimmerLabel key={label}>{label}</ShimmerLabel>
      </span>
      {elapsed !== undefined && <span {...mark(undefined, mono, styles.time)}>{elapsed}</span>}
    </div>
  );
}
