"use client";

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { color, font, radius } from "@/styles/tokens.stylex";

const still = "@media (prefers-reduced-motion: reduce)";

const sweep = stylex.keyframes({
  from: { backgroundPosition: "100% 0" },
  to: { backgroundPosition: "0% 0" },
});

const spinFrames = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const pulseFrames = stylex.keyframes({
  from: { opacity: 1 },
  "50%": { opacity: 0.5 },
  to: { opacity: 1 },
});

const pingFrames = stylex.keyframes({
  "75%": { transform: "scale(2)", opacity: 0 },
  "100%": { transform: "scale(2)", opacity: 0 },
});

const fadeFrames = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const riseFrames = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(4px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const riseFarFrames = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(8px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const dropFrames = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(-4px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const blurInFrames = stylex.keyframes({
  from: { opacity: 0, filter: "blur(2px)" },
  to: { opacity: 1, filter: "blur(0)" },
});

const popFrames = stylex.keyframes({
  from: { opacity: 0, transform: "scale(0.9)" },
  to: { opacity: 1, transform: "scale(1)" },
});

const styles = stylex.create({
  paper: {
    backgroundColor: "light-dark(var(--background), var(--popover))",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "color-mix(in oklab, var(--border) 60%, transparent)",
  },
  field: {
    backgroundColor: "light-dark(color-mix(in oklab, var(--foreground) 4%, transparent), color-mix(in oklab, var(--foreground) 6%, transparent))",
  },
  fieldInteractive: {
    backgroundColor: {
      default: "light-dark(color-mix(in oklab, var(--foreground) 4%, transparent), color-mix(in oklab, var(--foreground) 6%, transparent))",
      ":hover": "light-dark(color-mix(in oklab, var(--foreground) 7%, transparent), color-mix(in oklab, var(--foreground) 9%, transparent))",
    },
    transitionProperty: "background-color, color",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  pressable: {
    transform: { default: "scale(1)", ":active": "scale(0.96)" },
    transitionProperty: "transform",
    transitionDuration: { default: "150ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  ghostButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": "light-dark(color-mix(in oklab, var(--foreground) 6%, transparent), color-mix(in oklab, var(--foreground) 9%, transparent))",
      ":active": "light-dark(color-mix(in oklab, var(--foreground) 6%, transparent), color-mix(in oklab, var(--foreground) 9%, transparent))",
    },
    color: {
      default: "color-mix(in oklab, var(--foreground) 45%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 90%, transparent)",
      ":active": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    },
    transform: { default: "scale(1)", ":active": "scale(0.96)" },
    boxShadow: { ":focus-visible": "0 0 0 1px color-mix(in oklab, var(--foreground) 20%, transparent)" },
    transitionProperty: "background-color, color, scale",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  inkButton: {
    backgroundColor: color.foreground,
    color: color.background,
    opacity: { default: 1, ":hover": 0.9 },
    transform: { default: "scale(1)", ":active": "scale(0.96)" },
    transitionProperty: "opacity, scale",
    transitionDuration: { default: "150ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  iconSwap: {
    gridArea: "1 / 1",
    transitionProperty: "opacity, scale, filter",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  },
  iconSwapIn: { scale: 1, opacity: 1, filter: "blur(0)" },
  iconSwapOut: { scale: 0.25, opacity: 0, filter: "blur(4px)" },
  labelSwap: {
    gridColumnStart: 1,
    gridRowStart: 1,
    display: "flex",
    width: "max-content",
    alignItems: "center",
    gap: 6,
    lineHeight: 1,
    transitionProperty: "opacity, filter",
    transitionDuration: { default: "300ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  labelSwapIn: { opacity: 1, filter: "blur(0)" },
  labelSwapOut: { pointerEvents: "none", userSelect: "none", opacity: 0, filter: "blur(2px)" },
  collapsePanel: {
    height: {
      default: "var(--collapsible-panel-height)",
      "[data-ending-style]": 0,
      "[data-starting-style]": 0,
    },
    overflow: "hidden",
    transitionProperty: "height",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  live: { color: "light-dark(var(--color-blue-500), var(--color-blue-400))" },
  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: "-0.025em" },
  codeScroll: { overflowX: "auto" },
  codeSurface: { width: "max-content", minWidth: "100%" },
  shimmer: {
    position: "relative",
    display: "inline-block",
    lineHeight: 1,
    backgroundImage: {
      default: "linear-gradient(90deg, currentColor 0%, currentColor 40%, var(--foreground) 50%, currentColor 60%, currentColor 100%)",
      [still]: "none",
    },
    backgroundSize: "300% 100%",
    backgroundClip: { default: "text", [still]: "border-box" },
    color: { default: "transparent", [still]: "currentColor" },
    animationName: { default: sweep, [still]: "none" },
    animationDuration: "2.2s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  inline: { position: "relative", display: "inline-block", lineHeight: 1 },
  swap: {
    display: "grid",
    overflowX: "clip",
    transitionProperty: "width",
    transitionDuration: { default: "300ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  start: { textAlign: "start" },
  spin: {
    animationName: { default: spinFrames, [still]: "none" },
    animationDuration: "1s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  spinFast: {
    animationName: { default: spinFrames, [still]: "none" },
    animationDuration: "0.6s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  pulse: {
    animationName: { default: pulseFrames, [still]: "none" },
    animationDuration: "2s",
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
    animationIterationCount: "infinite",
  },
  ping: {
    animationName: { default: pingFrames, [still]: "none" },
    animationDuration: "1s",
    animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
    animationIterationCount: "infinite",
    display: { [still]: "none" },
  },
  fadeIn: {
    animationName: { default: fadeFrames, [still]: "none" },
    animationDuration: "300ms",
    animationFillMode: "both",
  },
  riseIn: {
    animationName: { default: riseFrames, [still]: "none" },
    animationDuration: "300ms",
    animationFillMode: "both",
  },
  riseFar: {
    animationName: { default: riseFarFrames, [still]: "none" },
    animationDuration: "300ms",
    animationFillMode: "both",
  },
  dropIn: {
    animationName: { default: dropFrames, [still]: "none" },
    animationDuration: "300ms",
    animationFillMode: "both",
  },
  blurIn: {
    animationName: { default: blurInFrames, [still]: "none" },
    animationDuration: "300ms",
    animationFillMode: "both",
  },
  popIn: {
    animationName: { default: popFrames, [still]: "none" },
    animationDuration: "200ms",
    animationFillMode: "both",
  },
  slow: { animationDuration: "500ms" },
  sr: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});

type Part = false | null | undefined | object;

export function mark(
  marker: string | undefined,
  ...parts: readonly Part[]
): { className?: string; style?: CSSProperties } {
  const visual = (stylex.props as (...args: readonly Part[]) => { className?: string; style?: CSSProperties })(...parts);
  const className = [marker, visual.className].filter(Boolean).join(" ") || undefined;
  return className === visual.className ? visual : { ...visual, className };
}

export function withClass(
  marker: string | undefined,
  extra: string | undefined,
  ...parts: readonly Part[]
): { className?: string; style?: CSSProperties } {
  const visual = mark(marker, ...parts);
  const className = [visual.className, extra].filter(Boolean).join(" ") || undefined;
  return { className, style: visual.style };
}

export const paper = styles.paper;
export const floating = styles.paper;
export const field = styles.field;
export const fieldInteractive = styles.fieldInteractive;
export const pressable = styles.pressable;
export const ghostButton = styles.ghostButton;
export const inkButton = styles.inkButton;
export const iconSwap = styles.iconSwap;
export const iconSwapIn = styles.iconSwapIn;
export const iconSwapOut = styles.iconSwapOut;
export const labelSwap = styles.labelSwap;
export const labelSwapIn = styles.labelSwapIn;
export const labelSwapOut = styles.labelSwapOut;
export const collapsePanel = styles.collapsePanel;
export const live = styles.live;
export const mono = styles.mono;
export const codeScroll = styles.codeScroll;
export const codeSurface = styles.codeSurface;
export const spin = styles.spin;
export const spinFast = styles.spinFast;
export const pulse = styles.pulse;
export const ping = styles.ping;
export const fadeIn = styles.fadeIn;
export const riseIn = styles.riseIn;
export const riseFar = styles.riseFar;
export const dropIn = styles.dropIn;
export const blurIn = styles.blurIn;
export const popIn = styles.popIn;
export const slow = styles.slow;
export const sr = styles.sr;
export const shimmer = styles.shimmer;

export function ShimmerLabel({
  active = true,
  className,
  ...props
}: Omit<ComponentProps<"span">, "className"> & { active?: boolean; className?: string }) {
  const visual = mark(undefined, styles.inline, active && styles.shimmer);
  if (!className) return <span {...visual} {...props} />;
  return (
    <span className={className}>
      <span {...visual} {...props} />
    </span>
  );
}

export function SwapLabel({
  active,
  children,
  align,
}: {
  active: 0 | 1;
  children: [ReactNode, ReactNode];
  align?: "start";
}) {
  const layers = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const target = layers[active]?.current;
    if (!target) return undefined;
    const measure = () => setWidth(Math.ceil(target.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [active]);

  const shell = mark(undefined, styles.swap, align === "start" && styles.start);
  return (
    <span style={width === null ? shell.style : { ...shell.style, width }} className={shell.className}>
      {children.map((layer, index) => (
        <span
          key={index}
          ref={layers[index]}
          aria-hidden={active !== index}
          {...mark(undefined, labelSwap, active === index ? labelSwapIn : labelSwapOut)}
        >
          {layer}
        </span>
      ))}
    </span>
  );
}
