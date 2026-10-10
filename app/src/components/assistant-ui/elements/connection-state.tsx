"use client";

import type { ComponentProps } from "react";
import { CheckIcon, CloudOffIcon, Loader2Icon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { radius } from "@/styles/tokens.stylex";
import { dropIn, mark, mono, paper, spin } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  card: {
    display: "flex",
    width: "100%",
    maxWidth: 384,
    alignItems: "center",
    gap: 10,
    borderRadius: radius.xxl,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  icon: { width: 14, height: 14, flexShrink: 0 },
  amber: { color: "light-dark(var(--color-amber-600), var(--color-amber-400))" },
  quiet: { color: "color-mix(in oklab, var(--foreground) 40%, transparent)" },
  dim: {
    flexShrink: 0,
    color: "color-mix(in oklab, var(--foreground) 30%, transparent)",
    fontVariantNumeric: "tabular-nums",
  },
  text: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: 0, fontSize: 13, lineHeight: "18px" },
  emerald: { color: "var(--color-emerald-500)" },
  retry: {
    flexShrink: 0,
    borderRadius: radius.full,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 500,
    color: {
      default: "color-mix(in oklab, var(--foreground) 70%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 95%, transparent)",
    },
    backgroundColor: { ":hover": "color-mix(in oklab, var(--foreground) 6%, transparent)" },
    transform: { default: "scale(1)", ":active": "scale(0.96)" },
    transitionProperty: "background-color, color, scale",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
});

export type ConnectionPhase = "online" | "dropped" | "reconnecting" | "resumed";

export function ConnectionState({
  phase,
  attempt,
  resumedTokens,
  onRetry,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "phase" | "attempt" | "resumedTokens" | "onRetry" | "className" | "style"
> & {
  phase: ConnectionPhase;
  attempt?: number;
  resumedTokens?: number;
  onRetry?: () => void;
}) {
  if (phase === "online") return null;

  return (
    <div data-slot="connection-state" {...mark(undefined, paper, styles.card, dropIn)} {...props}>
      {phase === "dropped" && (
        <>
          <CloudOffIcon {...mark(undefined, styles.icon, styles.amber)} />
          <span {...stylex.props(styles.text)}>
            Connection lost. The run kept going on the server.
          </span>
          <button type="button" onClick={onRetry} {...stylex.props(styles.retry)}>
            Reconnect
          </button>
        </>
      )}

      {phase === "reconnecting" && (
        <>
          <Loader2Icon {...mark(undefined, styles.icon, styles.quiet, spin)} />
          <span {...stylex.props(styles.text)}>Reconnecting</span>
          {attempt !== undefined && (
            <span {...mark(undefined, mono, styles.dim)}>attempt {attempt}</span>
          )}
        </>
      )}

      {phase === "resumed" && (
        <>
          <CheckIcon {...mark(undefined, styles.icon, styles.emerald)} />
          <span {...stylex.props(styles.text)}>Picked the stream back up.</span>
          {resumedTokens !== undefined && (
            <span {...mark(undefined, mono, styles.dim)}>+{resumedTokens} tokens</span>
          )}
        </>
      )}
    </div>
  );
}
