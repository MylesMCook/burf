"use client";

import type { ComponentProps, ReactNode } from "react";
import { CheckIcon, PauseIcon, RotateCcwIcon, XIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { color, radius } from "@/styles/tokens.stylex";
import { blurIn, mark, mono, paper, pulse, sr } from "./surfaces";

const styles = stylex.create({
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.full,
    paddingTop: 6,
    paddingBottom: 6,
    paddingInlineStart: 14,
    paddingInlineEnd: 6,
  },
  icon: { width: 12, height: 12, flexShrink: 0 },
  emerald: { color: "var(--color-emerald-500)" },
  bad: { color: color.destructive },
  dot: { width: 6, height: 6, flexShrink: 0, borderRadius: radius.full },
  live: { backgroundColor: "light-dark(var(--color-blue-500), var(--color-blue-400))" },
  wait: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "color-mix(in oklab, var(--foreground) 35%, transparent)",
  },
  label: {
    maxWidth: 176,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
    lineHeight: "16px",
  },
  time: { color: "color-mix(in oklab, var(--foreground) 30%, transparent)", fontVariantNumeric: "tabular-nums" },
  trail: {
    display: "flex",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    color: "color-mix(in oklab, var(--foreground) 45%, transparent)",
  },
});

export type AgentState = "working" | "waiting" | "done" | "failed";

export interface StatusStep {
  state: AgentState;
  label: string;
}

export function AgentStatus({
  state,
  label,
  elapsed,
  trailing,
  ...props
}: Omit<ComponentProps<"span">, "children" | "state" | "label" | "elapsed" | "className" | "style"> & {
  state: AgentState;
  label: string;
  elapsed?: string | undefined;
  trailing?: ReactNode | undefined;
}) {
  return (
    <span data-slot="agent-status" {...mark(undefined, paper, styles.pill)} {...props}>
      {state === "done" ? (
        <CheckIcon aria-hidden {...mark(undefined, styles.icon, styles.emerald)} />
      ) : state === "failed" ? (
        <XIcon aria-hidden {...mark(undefined, styles.icon, styles.bad)} />
      ) : (
        <span
          aria-hidden
          {...mark(undefined, styles.dot, state === "working" ? styles.live : styles.wait, state === "working" && pulse)}
        />
      )}
      <span {...mark(undefined, sr)}>{state}</span>
      <span key={label} {...mark(undefined, styles.label, blurIn)}>{label}</span>
      {elapsed !== undefined && state !== "done" && state !== "failed" && (
        <span {...mark(undefined, mono, styles.time)}>{elapsed}</span>
      )}
      <span aria-hidden data-slot="agent-status-trailing" {...mark(undefined, styles.trail)}>
        {trailing !== undefined ? (
          trailing
        ) : state === "done" || state === "failed" ? (
          <RotateCcwIcon {...stylex.props(styles.icon)} />
        ) : (
          <PauseIcon {...stylex.props(styles.icon)} />
        )}
      </span>
    </span>
  );
}
