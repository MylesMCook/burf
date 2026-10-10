"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  base: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
    cursor: "pointer",
    userSelect: "none",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    fontWeight: 500,
    fontSize: { default: 16, [sm]: 14 },
    color: color.foreground,
    outline: "none",
    backgroundColor: { default: "transparent", ":hover": color.accent, "[data-pressed]": "color-mix(in oklab, var(--input) 64%, transparent)" },
    boxShadow: {
      default: "none",
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)",
    },
    opacity: { default: 1, ":disabled": 0.64 },
    pointerEvents: { default: "auto", ":disabled": "none" },
  },
  sizeDefault: {
    height: { default: 36, [sm]: 32 },
    minWidth: { default: 36, [sm]: 32 },
    paddingLeft: 7,
    paddingRight: 7,
  },
  sizeLg: {
    height: { default: 40, [sm]: 36 },
    minWidth: { default: 40, [sm]: 36 },
    paddingLeft: 9,
    paddingRight: 9,
  },
  sizeSm: {
    height: { default: 32, [sm]: 28 },
    minWidth: { default: 32, [sm]: 28 },
    paddingLeft: 5,
    paddingRight: 5,
  },
  outline: {
    borderColor: color.input,
    backgroundColor: {
      default: "var(--control-fill)",
      ":hover": color.accent,
      "[data-pressed]": "color-mix(in oklab, var(--input) 64%, transparent)",
    },
  },
  plain: { borderColor: "transparent" },
  choice: {
    height: 28,
    minWidth: 28,
    borderRadius: radius.md,
    fontWeight: { default: 400, "[data-pressed]": 500 },
    fontSize: 13,
    color: {
      default: color.mutedForeground,
      ":hover": color.foreground,
      "[data-pressed]": color.foreground,
    },
    backgroundColor: {
      default: "transparent",
      ":hover": "color-mix(in oklab, var(--background) 60%, transparent)",
      "[data-pressed]": color.background,
    },
  },
  warning: {
    backgroundColor: { default: "transparent", "[data-pressed]": "var(--tint-warning)" },
    color: { default: color.mutedForeground, "[data-pressed]": "var(--warning-foreground)" },
  },
});

export type ToggleVariant = "default" | "outline";
export type ToggleSize = "default" | "sm" | "lg";

export function Toggle({
  variant = "default",
  size = "default",
  tone,
  ...props
}: Omit<TogglePrimitive.Props, "className" | "style"> & {
  variant?: ToggleVariant | null;
  size?: ToggleSize | null;
  tone?: "choice" | "warning";
}): React.ReactElement {
  const visual = stylex.props(
    styles.base,
    size === "lg" ? styles.sizeLg : size === "sm" ? styles.sizeSm : styles.sizeDefault,
    variant === "outline" ? styles.outline : styles.plain,
    (tone === "choice" || tone === "warning") && styles.choice,
    tone === "warning" && styles.warning,
  );
  return <TogglePrimitive className={visual.className} data-slot="toggle" {...props} />;
}

export { TogglePrimitive };
