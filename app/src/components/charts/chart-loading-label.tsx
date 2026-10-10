"use client";

import * as stylex from "@stylexjs/stylex";
import { motion } from "motion/react";
import { ShimmeringText } from "./shimmering-text";
import {
  LINE_LOADING_PULSE_EASE,
  LOADING_LABEL_EXIT_S,
  LOADING_LABEL_EXIT_Y_PX,
} from "./line-loading-timing";

const paint = stylex.create({
  s0: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s1: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
    "letterSpacing": "0.025em",
    "-Color": "var(--muted-foreground)",
    "-ShimmeringColor": "var(--foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface ChartLoadingLabelProps {
  /** Label shown centered over the chart. */
  text?: string;
  className?: string;
  /** Animate down, fade, and blur during loading → ready handoff. */
  exiting?: boolean;
}

export function ChartLoadingLabel({
  text = "Loading",
  className,
  exiting = false,
}: ChartLoadingLabelProps) {
  if (!text.trim()) {
    return null;
  }

  return (
    <motion.div
      animate={{
        y: exiting ? LOADING_LABEL_EXIT_Y_PX : 0,
        opacity: exiting ? 0 : 1,
        filter: exiting ? "blur(2px)" : "blur(0px)",
      }}
      aria-live="polite"
      className={[sx(paint.s0), className].filter(Boolean).join(" ")}
      initial={false}
      role="status"
      transition={{
        duration: LOADING_LABEL_EXIT_S,
        ease: [...LINE_LOADING_PULSE_EASE],
      }}
    >
      <ShimmeringText
        className={sx(paint.s1)}
        text={text}
      />
    </motion.div>
  );
}

export default ChartLoadingLabel;
