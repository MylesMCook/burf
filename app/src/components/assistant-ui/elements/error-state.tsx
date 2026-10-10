"use client";

import type { ComponentProps } from "react";
import { CircleAlertIcon, RefreshCwIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { radius } from "@/styles/tokens.stylex";
import { fadeIn, mark, ShimmerLabel, spin } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";
const red = "light-dark(var(--color-red-600), var(--color-red-400))";

const styles = stylex.create({
  row: {
    display: "flex",
    width: "100%",
    maxWidth: 384,
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    lineHeight: "20px",
  },
  alert: {
    display: "flex",
    width: "100%",
    maxWidth: 384,
    alignItems: "flex-start",
    gap: 10,
    borderRadius: radius.xxl,
    backgroundColor: "light-dark(color-mix(in oklab, var(--color-red-500) 6%, transparent), color-mix(in oklab, var(--color-red-500) 10%, transparent))",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    lineHeight: "20px",
  },
  spinIcon: { width: 14, height: 14, flexShrink: 0, color: "color-mix(in oklab, var(--foreground) 45%, transparent)" },
  retrying: { color: "color-mix(in oklab, var(--foreground) 55%, transparent)" },
  warn: { marginTop: 2, width: 16, height: 16, flexShrink: 0, color: "color-mix(in oklab, var(--color-red-500) 80%, transparent)" },
  title: { fontWeight: 500, color: red },
  detail: { marginTop: 2, fontSize: 13, lineHeight: 1.375, color: "light-dark(color-mix(in oklab, var(--color-red-600) 60%, transparent), color-mix(in oklab, var(--color-red-400) 60%, transparent))" },
  retry: {
    marginInlineStart: "auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.full,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 4,
    paddingBottom: 4,
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 500,
    color: red,
    backgroundColor: { ":hover": "color-mix(in oklab, var(--color-red-500) 10%, transparent)" },
    transitionProperty: "background-color, color",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  retryIcon: { width: 12, height: 12 },
});

export interface ErrorStateProps extends Omit<
  ComponentProps<"div">,
  "children" | "role" | "className" | "style"
> {
  title: string;
  detail: string;
  retrying: boolean;
  onRetry: () => void;
}

export function ErrorState({
  title,
  detail,
  retrying,
  onRetry,
  ...props
}: ErrorStateProps) {
  if (retrying) {
    return (
      <div data-slot="error-state" key="retrying" role="status" {...mark(undefined, styles.row, fadeIn)} {...props}>
        <RefreshCwIcon {...mark(undefined, styles.spinIcon, spin)} />
        <span {...stylex.props(styles.retrying)}>
          <ShimmerLabel>Retrying</ShimmerLabel>
        </span>
      </div>
    );
  }

  return (
    <div data-slot="error-state" key="error" role="alert" {...mark(undefined, styles.alert, fadeIn)} {...props}>
      <CircleAlertIcon {...mark(undefined, styles.warn)} />
      <div>
        <p {...mark(undefined, styles.title)}>{title}</p>
        <p {...mark(undefined, styles.detail)}>{detail}</p>
      </div>
      <button type="button" onClick={onRetry} {...mark(undefined, styles.retry)}>
        <RefreshCwIcon {...mark(undefined, styles.retryIcon)} />
        Retry
      </button>
    </div>
  );
}
