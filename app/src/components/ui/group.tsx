"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import { Separator } from "@/components/ui/separator";
import { color, radius } from "@/styles/tokens.stylex";


const sm = "@media (min-width: 640px)";
const coarse = "@media (pointer: coarse)";

const joinEnd = ":not(#\\#) > [data-slot]:has(~ [data-slot])";
const joinStart = ":not(#\\#) > [data-slot] ~ [data-slot]";
const nearestAfter =
  ":not(#\\#) > [data-slot=separator]:is(:has(~ button:hover):not(:has(~ [data-slot=separator] ~ [data-slot]:hover)), :has(~ [data-slot][data-pressed]):not(:has(~ [data-slot=separator] ~ [data-slot][data-pressed])))::before";
const nearestBefore =
  ":not(#\\#) > :is(button:hover ~ [data-slot=separator]:not([data-slot]:hover ~ [data-slot=separator] ~ [data-slot=separator]), [data-slot][data-pressed] ~ [data-slot=separator]:not([data-slot][data-pressed] ~ [data-slot=separator] ~ [data-slot=separator]))::before";

const styles = stylex.create({
  base: {
    display: "flex",
    width: "fit-content",
    ":has(> [data-slot=group])": { gap: 8 },
    ":not(#\\#) > :focus-visible": { zIndex: 1 },
    ":not(#\\#) > :has(:focus-visible)": { zIndex: 1 },
    [nearestAfter]: { backgroundColor: "var(--separator-hot)" },
    [nearestBefore]: { backgroundColor: "var(--separator-hot)" },
  },
  row: {
    ":not(#\\#) > *::after": { minWidth: { [coarse]: "auto" } },
    [joinEnd]: {
      borderStartEndRadius: 0,
      borderEndEndRadius: 0,
      borderInlineEndWidth: 0,
    },
    [`${joinEnd}::before`]: {
      borderStartEndRadius: 0,
      borderEndEndRadius: 0,
    },
    [`${joinEnd}:not([data-slot=separator])::before`]: { insetInlineEnd: -0.5 },
    [joinStart]: {
      borderStartStartRadius: 0,
      borderEndStartRadius: 0,
      borderInlineStartWidth: 0,
    },
    [`${joinStart}::before`]: {
      borderStartStartRadius: 0,
      borderEndStartRadius: 0,
    },
    [`${joinStart}:not([data-slot=separator])::before`]: { insetInlineStart: -0.5 },
  },
  column: {
    flexDirection: "column",
    ":not(#\\#) > *::after": { minHeight: { [coarse]: "auto" } },
    ":not(#\\#) > [data-slot]:has(~ [data-slot])": {
      borderEndStartRadius: 0,
      borderEndEndRadius: 0,
      borderBottomWidth: 0,
    },
    ":not(#\\#) > [data-slot]:has(~ [data-slot])::before": {
      borderEndStartRadius: 0,
      borderEndEndRadius: 0,
    },
    ":not(#\\#) > [data-slot]:not([data-slot=separator]):has(~ [data-slot])::before": {
      bottom: -0.5,
      display: "none",
    },
    ":not(#\\#) > [data-slot] ~ [data-slot]": {
      borderStartStartRadius: 0,
      borderStartEndRadius: 0,
      borderTopWidth: 0,
    },
    ":not(#\\#) > [data-slot] ~ [data-slot]::before": {
      borderStartStartRadius: 0,
      borderStartEndRadius: 0,
    },
    ":not(#\\#) > [data-slot] ~ [data-slot]:not([data-slot=separator])::before": { top: -0.5 },
  },
  text: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.input,
    backgroundColor: "var(--control-fill)",
    paddingLeft: 11,
    paddingRight: 11,
    fontSize: { default: 16, [sm]: 14 },
    color: color.mutedForeground,
    outline: "none",
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-lg) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
    ":not(#\\#) svg": {
      flexShrink: 0,
      marginLeft: -2,
      marginRight: -2,
      width: { default: 18, [sm]: 16 },
      height: { default: 18, [sm]: 16 },
    },
  },
});

export function Group({
  orientation = "horizontal",
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  orientation?: "horizontal" | "vertical";
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={stylex.props(styles.base, orientation === "vertical" ? styles.column : styles.row).className}
      data-orientation={orientation}
      data-slot="group"
      role="group"
      {...props}
    >
      {children}
    </div>
  );
}

export function GroupText({ render, ...props }: Omit<useRender.ComponentProps<"div">, "className">): React.ReactElement {
  const defaultProps = {
    className: stylex.props(styles.text).className,
    "data-slot": "group-text",
  };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

export function GroupSeparator({
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>): React.ReactElement {
  return <Separator orientation={orientation} shift tone="input" {...props} />;
}

export { Group as ButtonGroup, GroupText as ButtonGroupText, GroupSeparator as ButtonGroupSeparator };
