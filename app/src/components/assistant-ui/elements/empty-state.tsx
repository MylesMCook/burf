"use client";

import type { ComponentProps, CSSProperties } from "react";
import { ArrowUpIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { radius } from "@/styles/tokens.stylex";
import { inkButton, mark, paper, riseFar, riseIn, slow } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  root: { display: "flex", width: "100%", maxWidth: 448, flexDirection: "column", alignItems: "center", gap: 28 },
  greeting: { textAlign: "center", fontSize: 24, lineHeight: "32px", fontWeight: 500, letterSpacing: "-0.025em" },
  suggestions: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  chip: {
    borderRadius: radius.full,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 13,
    lineHeight: "18px",
    outline: "none",
    transform: { default: "scale(1)", ":hover": "translateY(-1px)", ":active": "scale(0.96)" },
    boxShadow: { ":focus-visible": "0 0 0 1px color-mix(in oklab, var(--foreground) 20%, transparent)" },
    transitionProperty: "transform",
    transitionDuration: { default: "500ms", [still]: "0s" },
  },
  composer: {
    display: "flex",
    height: 52,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.full,
    paddingTop: 8,
    paddingBottom: 8,
    paddingInlineStart: 20,
    paddingInlineEnd: 10,
  },
  placeholder: { fontSize: 15, color: "color-mix(in oklab, var(--foreground) 35%, transparent)" },
  send: {
    display: "flex",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    opacity: { default: 1, ":disabled": 0.3 },
    pointerEvents: { default: "auto", ":disabled": "none" },
  },
  sendIcon: { width: 16, height: 16 },
});

function painted(delay: string | undefined, style: CSSProperties | undefined, ...parts: readonly (false | null | undefined | object)[]) {
  const visual = mark(undefined, ...parts);
  return { className: visual.className, style: { ...visual.style, ...(delay ? { animationDelay: delay } : {}), ...style } };
}

export function EmptyState({ ...props }: Omit<ComponentProps<"div">, "className" | "style">) {
  return <div data-slot="empty-state" {...mark(undefined, styles.root)} {...props} />;
}

export function EmptyStateGreeting({ ...props }: Omit<ComponentProps<"h2">, "className" | "style">) {
  return <h2 data-slot="empty-state-greeting" {...mark(undefined, styles.greeting, riseIn, slow)} {...props} />;
}

export function EmptyStateSuggestions({ ...props }: Omit<ComponentProps<"div">, "className" | "style">) {
  return <div data-slot="empty-state-suggestions" {...mark(undefined, styles.suggestions)} {...props} />;
}

export function EmptyStateSuggestion({
  index = 0,
  style,
  ...props
}: Omit<ComponentProps<"button">, "className"> & { index?: number }) {
  return (
    <button
      type="button"
      data-slot="empty-state-suggestion"
      {...painted(`${120 + index * 70}ms`, style, paper, styles.chip, riseFar, slow)}
      {...props}
    />
  );
}

export function EmptyStateComposer({
  placeholder,
  onSend,
  style,
  ...props
}: Omit<ComponentProps<"div">, "children" | "placeholder" | "className"> & {
  placeholder: string;
  onSend?: () => void;
}) {
  return (
    <div data-slot="empty-state-composer" {...painted("360ms", style, paper, styles.composer, riseFar, slow)} {...props}>
      <span {...mark(undefined, styles.placeholder)}>{placeholder}</span>
      <button
        type="button"
        aria-label="Send"
        onClick={onSend}
        disabled={!onSend}
        {...mark(undefined, inkButton, styles.send)}
      >
        <ArrowUpIcon {...mark(undefined, styles.sendIcon)} />
      </button>
    </div>
  );
}
