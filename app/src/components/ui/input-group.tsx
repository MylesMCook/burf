"use client";

import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";

export type InputGroupAlign = "inline-start" | "inline-end" | "block-start" | "block-end";

const styles = stylex.create({
  group: {
    position: "relative",
    display: "inline-flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: color.input,
      ":has(input:focus-visible, textarea:focus-visible)": color.ring,
      ':has(input[aria-invalid="true"], textarea[aria-invalid="true"])': "color-mix(in oklab, var(--destructive) 36%, transparent)",
      ':has(input:focus-visible, textarea:focus-visible):has(input[aria-invalid="true"], textarea[aria-invalid="true"])':
        "color-mix(in oklab, var(--destructive) 64%, transparent)",
    },
    backgroundColor: {
      default: "var(--control-fill)",
      ":has(:autofill)": "var(--control-autofill)",
    },
    color: color.foreground,
    fontSize: { default: 16, [sm]: 14 },
    boxShadow: {
      default: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
      ":has(input:focus-visible, textarea:focus-visible)": "0 0 0 3px color-mix(in oklab, var(--ring) 24%, transparent)",
      ':has(input:focus-visible, textarea:focus-visible):has(input[aria-invalid="true"], textarea[aria-invalid="true"])': "0 0 0 3px var(--invalid-ring)",
      ":has(input:disabled, textarea:disabled)": "none",
      ':has(input[aria-invalid="true"], textarea[aria-invalid="true"])': "none",
    },
    opacity: { default: 1, ":has(input:disabled, textarea:disabled)": 0.64 },
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-lg) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
    ":has(textarea)": { height: "auto" },
    ":has([data-align=block-start], [data-align=block-end])": { height: "auto", flexDirection: "column" },
    ":not(#\\#) [data-slot=input-control]": { display: "contents" },
    ":not(#\\#) [data-slot=textarea-control]": { display: "contents" },
    ":not(#\\#) textarea": {
      minHeight: { default: 94, [sm]: 82 },
      resize: "none",
      paddingTop: 11,
      paddingBottom: 11,
    },
    ":has([data-align=inline-start]) :not(#\\#) input": { paddingLeft: 8 },
    ":has([data-align=inline-end]) :not(#\\#) input": { paddingRight: 8 },
  },
  addon: {
    display: "flex",
    height: "auto",
    cursor: "text",
    userSelect: "none",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ":not(#\\#) svg": { marginLeft: -2, marginRight: -2, opacity: 0.8 },
    ":not(#\\#) kbd": { borderRadius: "calc(var(--radius) - 5px)" },
  },
  inlineStart: { order: 0, paddingLeft: 11 },
  inlineEnd: { order: 1, paddingRight: 11 },
  blockStart: { order: 0, width: "100%", justifyContent: "flex-start", paddingLeft: 11, paddingRight: 11, paddingTop: 11 },
  blockEnd: { order: 1, width: "100%", justifyContent: "flex-start", paddingLeft: 11, paddingRight: 11, paddingBottom: 11 },
  text: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: color.mutedForeground,
    ":not(#\\#) svg": { pointerEvents: "none", marginLeft: -2, marginRight: -2 },
  },
});

const alignStyle = {
  "inline-start": styles.inlineStart,
  "inline-end": styles.inlineEnd,
  "block-start": styles.blockStart,
  "block-end": styles.blockEnd,
} as const;

export function InputGroup(props: Omit<React.ComponentProps<"div">, "className">): React.ReactElement {
  return <div className={stylex.props(styles.group).className} data-slot="input-group" role="group" {...props} />;
}

export function InputGroupAddon({
  align = "inline-start",
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { align?: InputGroupAlign }): React.ReactElement {
  return (
    <div
      className={stylex.props(styles.addon, alignStyle[align]).className}
      data-align={align}
      data-slot="input-group-addon"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as Element;
        if (!e.currentTarget.contains(target)) return;
        const isInteractive = target.closest("button, a, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [data-slot='select-trigger']");
        if (isInteractive) return;
        e.preventDefault();
        const parent = e.currentTarget.parentElement;
        const input = parent?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
        if (input && !parent?.querySelector("input:focus, textarea:focus")) input.focus();
      }}
      {...props}
    />
  );
}

export function InputGroupText(props: Omit<React.ComponentProps<"span">, "className">): React.ReactElement {
  return <span className={stylex.props(styles.text).className} {...props} />;
}

export function InputGroupInput(props: InputProps): React.ReactElement {
  return <Input unstyled {...props} />;
}

export function InputGroupTextarea(props: TextareaProps): React.ReactElement {
  return <Textarea unstyled {...props} />;
}
