"use client";

import * as stylex from "@stylexjs/stylex";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { type ComponentProps, useCallback } from "react";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "userSelect": "none",
    "alignItems": "center",
    "lineHeight": "1",
  },
  s1: {
    "-Color": "var(--muted-foreground)",
    "-ShimmeringColor": "var(--foreground)",
  },
  s2: {
    "display": "inline-block",
    "whiteSpace": "pre",
    "lineHeight": "1",
  },
  s3: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export type ShimmeringTextProps = Omit<
  ComponentProps<typeof motion.span>,
  "children"
> & {
  /** The text to render with the shimmering effect. */
  text: string;
  /**
   * Duration in seconds for one shimmer cycle.
   * @defaultValue 1
   */
  duration?: number;
  /**
   * Pause the shimmer (e.g. when the hero leaves the viewport).
   * @defaultValue false
   */
  paused?: boolean;
  /**
   * Legacy alias for `paused`.
   * @defaultValue false
   */
  isStopped?: boolean;
};

export function ShimmeringText({
  text,
  duration = 1,
  isStopped = false,
  paused = false,
  className,
  ...props
}: ShimmeringTextProps) {
  const reducedMotion = useReducedMotion();
  const stopped = isStopped || paused || reducedMotion === true;

  const createCharVariants = useCallback(
    (charIndex: number): Variants => ({
      running: {
        color: ["var(--color)", "var(--shimmering-color)", "var(--color)"],
        transition: {
          duration,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "loop",
          repeatDelay: text.length * 0.05,
          delay: (charIndex * duration) / text.length,
          ease: "easeInOut",
        },
      },
      stopped: {
        color: "var(--color)",
        transition: {
          duration: duration * 0.5,
          ease: "easeOut",
        },
      },
    }),
    [duration, text.length]
  );

  return (
    <motion.span
      className={[sx(paint.s0), sx(paint.s1), className].filter(Boolean).join(" ")}
      {...props}
    >
      {text.split("").map((char, index) => (
        <motion.span
          animate={stopped ? "stopped" : "running"}
          aria-hidden
          className={sx(paint.s2)}
          initial="stopped"
          // biome-ignore lint/suspicious/noArrayIndexKey: static label text, order never changes
          key={index}
          variants={createCharVariants(index)}
        >
          {char}
        </motion.span>
      ))}
      <span className={sx(paint.s3)}>{text}</span>
    </motion.span>
  );
}
