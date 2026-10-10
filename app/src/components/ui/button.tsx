"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import { Spinner } from "@/components/ui/spinner";
import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";
const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  base: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    fontWeight: 500,
    fontSize: { default: 16, [sm]: 14 },
    lineHeight: "20px",
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)",
    },
    transitionProperty: "background-color, box-shadow, border-color",
    transitionDuration: { default: "150ms", [still]: "0s" },
    opacity: { default: 1, ":disabled": 0.64 },
    pointerEvents: { default: "auto", ":disabled": "none" },
  },
  sizeDefault: {
    height: { default: 36, [sm]: 32 },
    paddingLeft: 11,
    paddingRight: 11,
  },
  sizeSm: {
    height: { default: 32, [sm]: 28 },
    gap: 6,
    paddingLeft: 9,
    paddingRight: 9,
  },
  sizeLg: {
    height: { default: 40, [sm]: 36 },
    paddingLeft: 13,
    paddingRight: 13,
  },
  sizeXl: {
    height: { default: 44, [sm]: 40 },
    paddingLeft: 15,
    paddingRight: 15,
    fontSize: { default: 18, [sm]: 16 },
  },
  sizeXs: {
    height: { default: 28, [sm]: 24 },
    gap: 4,
    borderRadius: radius.md,
    paddingLeft: 7,
    paddingRight: 7,
    fontSize: { default: 14, [sm]: 12 },
  },
  icon: { width: { default: 36, [sm]: 32 }, height: { default: 36, [sm]: 32 }, paddingLeft: 0, paddingRight: 0 },
  iconSm: { width: { default: 32, [sm]: 28 }, height: { default: 32, [sm]: 28 }, paddingLeft: 0, paddingRight: 0 },
  iconXs: {
    width: { default: 28, [sm]: 24 },
    height: { default: 28, [sm]: 24 },
    borderRadius: radius.md,
    paddingLeft: 0,
    paddingRight: 0,
  },
  iconLg: { width: { default: 40, [sm]: 36 }, height: { default: 40, [sm]: 36 }, paddingLeft: 0, paddingRight: 0 },
  iconXl: { width: { default: 44, [sm]: 40 }, height: { default: 44, [sm]: 40 }, paddingLeft: 0, paddingRight: 0 },
  primary: {
    borderColor: color.primary,
    backgroundColor: { default: color.primary, ":hover": "color-mix(in oklab, var(--primary) 90%, transparent)", ":active": "color-mix(in oklab, var(--primary) 90%, transparent)" },
    color: color.primaryForeground,
    boxShadow: { default: "0 1px 2px color-mix(in oklab, var(--primary) 24%, transparent)", ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)", ":active": "none", ":disabled": "none" },
  },
  destructive: {
    borderColor: color.destructive,
    backgroundColor: { default: color.destructive, ":hover": "color-mix(in oklab, var(--destructive) 90%, transparent)", ":active": "color-mix(in oklab, var(--destructive) 90%, transparent)" },
    color: "white",
    boxShadow: { default: "0 1px 2px color-mix(in oklab, var(--destructive) 24%, transparent)", ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)", ":active": "none", ":disabled": "none" },
  },
  destructiveOutline: {
    borderColor: { default: color.input, ":hover": "color-mix(in oklab, var(--destructive) 32%, transparent)", ":active": "color-mix(in oklab, var(--destructive) 32%, transparent)" },
    backgroundColor: { default: color.popover, ":hover": "color-mix(in oklab, var(--destructive) 4%, transparent)", ":active": "color-mix(in oklab, var(--destructive) 4%, transparent)" },
    color: color.destructiveForeground,
  },
  ghost: {
    borderColor: "transparent",
    backgroundColor: { default: "transparent", ":hover": color.accent, ":active": color.accent },
    color: color.foreground,
  },
  link: {
    borderColor: "transparent",
    backgroundColor: "transparent",
    color: color.foreground,
    textDecoration: { default: "none", ":hover": "underline", ":active": "underline" },
    textUnderlineOffset: "4px",
  },
  outline: {
    borderColor: color.input,
    backgroundColor: { default: color.popover, ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)", ":active": "color-mix(in oklab, var(--accent) 50%, transparent)" },
    color: color.foreground,
    boxShadow: { default: "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)", ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)", ":active": "none", ":disabled": "none" },
  },
  secondary: {
    borderColor: "transparent",
    backgroundColor: { default: color.secondary, ":hover": "color-mix(in oklab, var(--secondary) 90%, transparent)", ":active": "color-mix(in oklab, var(--secondary) 80%, transparent)" },
    color: color.secondaryForeground,
  },
  muted: {
    color: color.mutedForeground,
  },
  label: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "inherit",
  },
  hiddenLabel: {
    visibility: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    borderRadius: "inherit",
  },
  alignStart: {
    justifyContent: "flex-start",
    width: "100%",
    height: 32,
    gap: 8,
    borderRadius: radius.md,
    paddingLeft: 10,
    paddingRight: 10,
    fontSize: 14,
    fontWeight: 400,
    backgroundColor: {
      default: "transparent",
      ":hover": color.muted,
      ":active": color.muted,
      "[data-active]": color.muted,
    },
  },
  square7: {
    width: 28,
    height: 28,
    paddingLeft: 0,
    paddingRight: 0,
  },
});

export type ButtonVariant = "default" | "destructive" | "destructive-outline" | "ghost" | "link" | "outline" | "secondary";
export type ButtonSize = "default" | "sm" | "lg" | "xl" | "xs" | "icon" | "icon-sm" | "icon-xs" | "icon-lg" | "icon-xl";

const variantStyle = {
  default: styles.primary,
  destructive: styles.destructive,
  "destructive-outline": styles.destructiveOutline,
  ghost: styles.ghost,
  link: styles.link,
  outline: styles.outline,
  secondary: styles.secondary,
} as const;

const sizeStyle = {
  default: styles.sizeDefault,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
  xl: styles.sizeXl,
  xs: styles.sizeXs,
  icon: styles.icon,
  "icon-sm": styles.iconSm,
  "icon-xs": styles.iconXs,
  "icon-lg": styles.iconLg,
  "icon-xl": styles.iconXl,
} as const;

export function buttonClass(variant: ButtonVariant = "default", size: ButtonSize = "default", muted = false): string | undefined {
  return stylex.props(styles.base, variantStyle[variant], sizeStyle[size], muted && styles.muted).className;
}

export interface ButtonProps extends Omit<useRender.ComponentProps<"button">, "className" | "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  muted?: boolean;
  /** Stretch to a sized wrapper. The wrapper owns the box. */
  fill?: boolean;
  /** Full-width row, muted when hovered or data-active. */
  align?: "center" | "start";
  /** Fixed 28px square. Sidebar trigger. */
  square?: 7;
  /** Hook classes such as `aui-*`. Concatenated with the StyleX class, never a utility. */
  marker?: string;
}

export function Button({
  variant = "default",
  size = "default",
  render,
  children,
  loading = false,
  muted = false,
  fill = false,
  align = "center",
  square,
  marker,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] = render ? undefined : "button";
  const painted = stylex.props(
    styles.base,
    variantStyle[variant],
    sizeStyle[size],
    muted && styles.muted,
    align === "start" && styles.alignStart,
    square === 7 && styles.square7,
    fill && styles.fill,
  );
  const visual = marker
    ? { ...painted, className: [marker, painted.className].filter(Boolean).join(" ") }
    : painted;
  const defaultProps = {
    children: (
      <>
        <span {...stylex.props(styles.label, loading && styles.hiddenLabel)}>{children}</span>
        {loading ? <Spinner cover data-slot="button-loading-indicator" /> : null}
      </>
    ),
    "aria-disabled": loading || undefined,
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    disabled: isDisabled,
    type: typeValue,
  };
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(visual, defaultProps, props),
    render,
  });
}
