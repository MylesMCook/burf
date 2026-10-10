"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";


const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  base: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    whiteSpace: "nowrap",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    fontWeight: 500,
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)",
    },
    opacity: { default: 1, ":disabled": 0.64 },
    pointerEvents: { default: "auto", ":disabled": "none" },
    cursor: { default: "default", ":is(button, a)": "pointer" },
  },
  sizeDefault: {
    height: { default: 22, [sm]: 18 },
    minWidth: { default: 22, [sm]: 18 },
    paddingLeft: 3,
    paddingRight: 3,
    fontSize: { default: 14, [sm]: 12 },
  },
  sizeLg: {
    height: { default: 26, [sm]: 22 },
    minWidth: { default: 26, [sm]: 22 },
    paddingLeft: 5,
    paddingRight: 5,
    fontSize: { default: 16, [sm]: 14 },
  },
  sizeSm: {
    height: { default: 20, [sm]: 16 },
    minWidth: { default: 20, [sm]: 16 },
    borderRadius: 4,
    paddingLeft: 3,
    paddingRight: 3,
    fontSize: { default: 12, [sm]: 10 },
  },
  primary: { backgroundColor: color.primary, color: color.primaryForeground },
  destructive: { backgroundColor: color.destructive, color: "white" },
  error: { backgroundColor: "var(--tint-destructive)", color: color.destructiveForeground },
  info: { backgroundColor: "var(--tint-info)", color: "var(--info-foreground)" },
  outline: {
    borderColor: color.input,
    backgroundColor: "var(--control-fill)",
    color: color.foreground,
  },
  secondary: { backgroundColor: color.secondary, color: color.secondaryForeground },
  success: { backgroundColor: "var(--tint-success)", color: "var(--success-foreground)" },
  warning: { backgroundColor: "var(--tint-warning)", color: "var(--warning-foreground)" },
  muted: { color: color.mutedForeground },
  chip: {
    alignItems: "baseline",
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 13,
    lineHeight: 1,
    height: "auto",
    minWidth: 0,
  },
});

export type BadgeVariant = "default" | "destructive" | "error" | "info" | "outline" | "secondary" | "success" | "warning";
export type BadgeSize = "default" | "sm" | "lg";

const variantStyle = {
  default: styles.primary,
  destructive: styles.destructive,
  error: styles.error,
  info: styles.info,
  outline: styles.outline,
  secondary: styles.secondary,
  success: styles.success,
  warning: styles.warning,
} as const;

const sizeStyle = {
  default: styles.sizeDefault,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
} as const;

export interface BadgeProps extends Omit<useRender.ComponentProps<"span">, "className" | "style"> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  muted?: boolean;
  chip?: boolean;
  marker?: string;
}

export function Badge({
  variant = "default",
  size = "default",
  muted = false,
  chip = false,
  marker,
  render,
  ...props
}: BadgeProps): React.ReactElement {
  const painted = stylex.props(styles.base, variantStyle[variant], sizeStyle[size], muted && styles.muted, chip && styles.chip);
  const visual = {
    ...painted,
    className: marker ? [marker, painted.className].filter(Boolean).join(" ") : painted.className,
    "data-slot": "badge",
  };
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(visual, props),
    render,
  });
}
