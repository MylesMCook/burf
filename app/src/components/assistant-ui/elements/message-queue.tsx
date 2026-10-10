"use client";

import type { ComponentProps } from "react";
import { ArrowUpIcon, XIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { radius } from "@/styles/tokens.stylex";
import { field, ghostButton, mark, mono, paper, ping, riseIn } from "./surfaces";

const styles = stylex.create({
  root: { display: "flex", width: "100%", maxWidth: 384, flexDirection: "column", gap: 8 },
  loose: { maxWidth: "none" },
  card: { display: "flex", alignItems: "center", gap: 10, borderRadius: radius.xxl, padding: 12 },
  live: { position: "relative", display: "flex", width: 8, height: 8, flexShrink: 0 },
  ping: {
    position: "absolute",
    display: "inline-flex",
    width: "100%",
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: "color-mix(in oklab, var(--color-blue-500) 60%, transparent)",
  },
  dot: {
    position: "relative",
    display: "inline-flex",
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: "light-dark(var(--color-blue-500), var(--color-blue-400))",
  },
  running: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 13.5,
    color: "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  meta: { flexShrink: 0, color: "color-mix(in oklab, var(--foreground) 35%, transparent)" },
  counts: { display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingLeft: 4, paddingRight: 4 },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.xxl,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 8,
    paddingLeft: 12,
  },
  index: { width: 12, flexShrink: 0, color: "color-mix(in oklab, var(--foreground) 30%, transparent)", fontVariantNumeric: "tabular-nums" },
  text: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 13.5,
    color: "color-mix(in oklab, var(--foreground) 60%, transparent)",
  },
  arrow: { width: 12, height: 12, flexShrink: 0, color: "color-mix(in oklab, var(--foreground) 25%, transparent)" },
  close: { width: 14, height: 14 },
  remove: { width: 24, height: 24, flexShrink: 0 },
});

export interface QueuedMessage {
  id: string;
  text: string;
}

export function MessageQueue({
  running,
  paused = false,
  queued,
  onCancel,
  loose = false,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "running" | "queued" | "onCancel" | "className" | "style"
> & {
  running: string;
  paused?: boolean;
  queued: readonly QueuedMessage[];
  onCancel?: (id: string) => void;
  loose?: boolean;
}) {
  return (
    <div
      data-slot="message-queue"
      data-state={paused ? "held" : "running"}
      {...mark(undefined, styles.root, loose && styles.loose)}
      {...props}
    >
      <div {...mark(undefined, paper, styles.card)}>
        <span {...mark(undefined, styles.live)}>
          {!paused && <span {...mark(undefined, styles.ping, ping)} />}
          <span {...mark(undefined, styles.dot)} />
        </span>
        <span {...mark(undefined, styles.running)}>{running}</span>
        <span {...mark(undefined, mono, styles.meta)}>{paused ? "held" : "running"}</span>
      </div>

      {queued.length > 0 && (
        <div {...mark(undefined, styles.counts)}>
          <span {...mark(undefined, mono, styles.meta)}>{queued.length} queued</span>
          <span {...mark(undefined, mono, styles.meta)}>
            {paused ? "held until you send" : "sends when this finishes"}
          </span>
        </div>
      )}

      <ul {...mark(undefined, styles.list)}>
        {queued.map((message, index) => (
          <li key={message.id} {...mark(undefined, field, styles.item, riseIn)}>
            <span {...mark(undefined, mono, styles.index)}>{index + 1}</span>
            <span {...mark(undefined, styles.text)}>{message.text}</span>
            <ArrowUpIcon {...mark(undefined, styles.arrow)} />
            {onCancel && (
              <button
                type="button"
                aria-label={`Remove "${message.text}" from the queue`}
                onClick={() => onCancel(message.id)}
                {...mark(undefined, ghostButton, styles.remove)}
              >
                <XIcon {...stylex.props(styles.close)} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
