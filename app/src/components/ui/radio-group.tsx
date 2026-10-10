"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  group: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  root: {
    position: "relative",
    display: "inline-flex",
    width: { default: 18, [sm]: 16 },
    height: { default: 18, [sm]: 16 },
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.input,
    backgroundColor: "var(--control-fill)",
    outline: "none",
    boxShadow: {
      default: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)",
      ":disabled": "none",
    },
    opacity: { default: 1, ":disabled": 0.64 },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
  },
  checkedRoot: {
    backgroundColor: color.background,
  },
  invalid: {
    borderColor: {
      default: "color-mix(in oklab, var(--destructive) 36%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--destructive) 64%, transparent)",
    },
    boxShadow: {
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px color-mix(in oklab, var(--destructive) 48%, transparent)",
    },
  },
  indicator: {
    position: "absolute",
    top: -1,
    right: -1,
    bottom: -1,
    left: -1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: color.primary,
    "::before": {
      content: '""',
      width: { default: 8, [sm]: 6 },
      height: { default: 8, [sm]: 6 },
      borderRadius: radius.full,
      backgroundColor: color.primaryForeground,
    },
  },
  hidden: { display: "none" },
});

export function RadioGroup({
  ...props
}: Omit<RadioGroupPrimitive.Props, "className" | "style">): React.ReactElement {
  return <RadioGroupPrimitive {...stylex.props(styles.group)} data-slot="radio-group" {...props} />;
}

export function Radio({
  ...props
}: Omit<RadioPrimitive.Root.Props, "className" | "style">): React.ReactElement {
  return (
    <RadioPrimitive.Root
      className={(state) =>
        stylex.props(
          styles.root,
          state.checked && styles.checkedRoot,
          state.valid === false && styles.invalid,
        ).className
      }
      data-slot="radio"
      {...props}
    >
      <RadioPrimitive.Indicator
        className={(state) => stylex.props(styles.indicator, !state.checked && styles.hidden).className}
        data-slot="radio-indicator"
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroupPrimitive, RadioPrimitive, Radio as RadioGroupItem };
