"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import { color, font, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  shell: {
    position: "relative",
    display: "inline-flex",
    width: "100%",
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: color.input,
      ":has(:focus-visible)": color.ring,
      ':has([aria-invalid="true"])': "color-mix(in oklab, var(--destructive) 36%, transparent)",
      ':has(:focus-visible):has([aria-invalid="true"])': "color-mix(in oklab, var(--destructive) 64%, transparent)",
    },
    backgroundColor: {
      default: "var(--control-fill)",
      ":has(:autofill)": "var(--control-autofill)",
    },
    color: color.foreground,
    fontSize: { default: 16, [sm]: 14 },
    boxShadow: {
      default: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
      ":has(:focus-visible)": "0 0 0 3px color-mix(in oklab, var(--ring) 24%, transparent)",
      ':has(:focus-visible):has([aria-invalid="true"])': "0 0 0 3px var(--invalid-ring)",
      ":has(:disabled)": "none",
      ':has([aria-invalid="true"])': "none",
    },
    opacity: { default: 1, ":has(:disabled)": 0.64 },
    transitionProperty: "box-shadow",
    transitionDuration: "150ms",
  },
  bare: {
    display: "inline-flex",
    width: "100%",
    minWidth: 0,
  },
  field: {
    height: { default: 34, [sm]: 30 },
    width: "100%",
    minWidth: 0,
    borderRadius: "inherit",
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingLeft: 11,
    paddingRight: 11,
    color: color.foreground,
    lineHeight: { default: "34px", [sm]: "30px" },
    outline: "none",
    transitionProperty: "background-color",
    transitionDuration: "5000000s",
    transitionTimingFunction: "ease-in-out",
    "::placeholder": { color: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)" },
    ":autofill": { WebkitTextFillColor: "var(--foreground)" },
  },
  fieldSm: {
    height: { default: 30, [sm]: 26 },
    paddingLeft: 9,
    paddingRight: 9,
    lineHeight: { default: "30px", [sm]: "26px" },
  },
  fieldLg: {
    height: { default: 38, [sm]: 34 },
    lineHeight: { default: "38px", [sm]: "34px" },
  },
  search: {
    "::-webkit-search-cancel-button": { appearance: "none" },
    "::-webkit-search-decoration": { appearance: "none" },
    "::-webkit-search-results-button": { appearance: "none" },
    "::-webkit-search-results-decoration": { appearance: "none" },
  },
  mono: { fontFamily: font.mono },
  xs: { fontSize: 12 },
  time: { width: 112 },
  cap56: { maxWidth: 224 },
  cap72: { maxWidth: 288 },
  slot: { width: 64 },
  end: { textAlign: "right" },
  nums: { fontVariantNumeric: "tabular-nums" },
  line: {
    display: "flex",
    width: "100%",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: color.border,
    paddingTop: 2,
    paddingBottom: 2,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    fontWeight: 500,
    fontSize: 15,
  },
  insetShell: { paddingLeft: 28 },
  insetField: { paddingLeft: 30 },
  insetWide: { paddingLeft: 32 },
  rename: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 28,
    fontSize: 14,
  },
  renameField: {
    height: 28,
    paddingLeft: 10,
    paddingRight: 36,
    lineHeight: "28px",
    fontSize: 14,
  },
});

export type InputMeasure = "fill" | "time" | "slot" | "cap56" | "cap72";
export type InputInset = "shell" | "field" | "wide";

export type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  "size" | "className" | "style"
> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
  nativeInput?: boolean;
  mono?: boolean;
  text?: "default" | "xs";
  measure?: InputMeasure;
  inset?: InputInset;
  /** Thread rename row: a short field with room for the confirm control. */
  layout?: "rename";
  align?: "start" | "end";
  nums?: boolean;
  /** Unstyled field that is still a search line or a flow title. */
  plain?: "line" | "title";
};

export function Input({
  size = "default",
  unstyled = false,
  nativeInput = false,
  mono = false,
  text = "default",
  measure = "fill",
  inset,
  layout,
  align = "start",
  nums = false,
  plain,
  ...props
}: InputProps): React.ReactElement {
  const shell = stylex.props(
    unstyled ? styles.bare : styles.shell,
    plain === "line" && styles.line,
    plain === "title" && styles.title,
    mono && styles.mono,
    text === "xs" && styles.xs,
    measure === "time" && styles.time,
    measure === "slot" && styles.slot,
    measure === "cap56" && styles.cap56,
    measure === "cap72" && styles.cap72,
    inset === "shell" && styles.insetShell,
    layout === "rename" && styles.rename,
    align === "end" && styles.end,
    nums && styles.nums,
  );
  const field = stylex.props(
    styles.field,
    size === "sm" && styles.fieldSm,
    size === "lg" && styles.fieldLg,
    props.type === "search" && styles.search,
    mono && styles.mono,
    text === "xs" && styles.xs,
    inset === "field" && styles.insetField,
    inset === "wide" && styles.insetWide,
    layout === "rename" && styles.renameField,
    align === "end" && styles.end,
    nums && styles.nums,
    plain === "title" && styles.title,
  );
  const fieldProps = {
    className: field.className,
    "data-slot": "input",
    size: typeof size === "number" ? size : undefined,
    ...props,
  };
  return (
    <span {...shell} data-size={size} data-slot="input-control">
      {nativeInput ? <input {...fieldProps} /> : <InputPrimitive {...fieldProps} />}
    </span>
  );
}

export { InputPrimitive };
