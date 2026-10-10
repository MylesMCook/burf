"use client";

import type { ComponentProps } from "react";
import {
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { ghostButton, iconSwap, iconSwapIn, iconSwapOut, mark, spin } from "./surfaces";

const styles = stylex.create({
  row: { display: "flex", alignItems: "center", gap: 4 },
  button: { width: 28, height: 28, display: "grid", placeItems: "center" },
  copied: { color: "var(--color-emerald-500)" },
  pressed: {
    backgroundColor: "light-dark(color-mix(in oklab, var(--foreground) 6%, transparent), color-mix(in oklab, var(--foreground) 9%, transparent))",
    color: "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  icon: { width: 14, height: 14 },
});

export type Reaction = "up" | "down" | null;

export interface MessageActionsProps extends Omit<
  ComponentProps<"div">,
  "children" | "className" | "style"
> {
  copied: boolean;
  reaction: Reaction;
  regenerating: boolean;
  onCopy: () => void;
  onReactionChange: (reaction: Reaction) => void;
  onRegenerate: () => void;
  onMore: () => void;
}

export function MessageActions({
  copied,
  reaction,
  regenerating,
  onCopy,
  onReactionChange,
  onRegenerate,
  onMore,
  ...props
}: MessageActionsProps) {
  return (
    <div data-slot="message-actions" {...mark(undefined, styles.row)} {...props}>
      <button
        type="button"
        aria-label={copied ? "Copied response" : "Copy response"}
        onClick={onCopy}
        {...mark(undefined, ghostButton, styles.button, copied && styles.copied)}
      >
        <CopyIcon {...mark(undefined, iconSwap, styles.icon, copied ? iconSwapOut : iconSwapIn)} />
        <CheckIcon {...mark(undefined, iconSwap, styles.icon, copied ? iconSwapIn : iconSwapOut)} />
      </button>
      <button
        type="button"
        aria-label="Mark response helpful"
        aria-pressed={reaction === "up"}
        onClick={() => onReactionChange(reaction === "up" ? null : "up")}
        {...mark(undefined, ghostButton, styles.button, reaction === "up" && styles.pressed)}
      >
        <ThumbsUpIcon {...mark(undefined, styles.icon)} />
      </button>
      <button
        type="button"
        aria-label="Mark response unhelpful"
        aria-pressed={reaction === "down"}
        onClick={() => onReactionChange(reaction === "down" ? null : "down")}
        {...mark(undefined, ghostButton, styles.button, reaction === "down" && styles.pressed)}
      >
        <ThumbsDownIcon {...mark(undefined, styles.icon)} />
      </button>
      <button type="button" aria-label="Regenerate response" onClick={onRegenerate} {...mark(undefined, ghostButton, styles.button)}>
        <RefreshCwIcon {...mark(undefined, styles.icon, regenerating && spin)} />
      </button>
      <button type="button" aria-label="More response actions" onClick={onMore} {...mark(undefined, ghostButton, styles.button)}>
        <EllipsisIcon {...mark(undefined, styles.icon)} />
      </button>
    </div>
  );
}
