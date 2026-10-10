"use client";

import { useMessageTiming } from "@assistant-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FC } from "react";
import * as stylex from "@stylexjs/stylex";

import { color, font, radius } from "@/styles/tokens.stylex";
import { mark, withClass } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  trigger: {
    display: "flex",
    alignItems: "center",
    borderRadius: radius.md,
    padding: 4,
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: "16px",
    fontVariantNumeric: "tabular-nums",
    color: { default: color.mutedForeground, ":hover": color.accentForeground },
    backgroundColor: { ":hover": color.accent },
    transitionProperty: "background-color, color",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  grid: { display: "grid", minWidth: 140, gap: 6, fontSize: 12, lineHeight: "16px" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  label: { color: color.mutedForeground },
  value: { fontFamily: font.mono, fontVariantNumeric: "tabular-nums" },
});

const formatTimingMs = (ms: number | undefined): string => {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

/**
 * Shows streaming stats (TTFT, total time, tok/s, chunks) as a badge with a
 * hover/focus tooltip. Renders nothing until the stream completes.
 *
 * Place it inside `ActionBarPrimitive.Root` in your `thread.tsx` so it
 * inherits the action bar's autohide behaviour:
 *
 * ```tsx
 * import { MessageTiming } from "@/components/assistant-ui/elements/message-timing.aui";
 *
 * <ActionBarPrimitive.Root >
 *   <ActionBarPrimitive.Copy />
 *   <ActionBarPrimitive.Reload />
 *   <MessageTiming />  // <-- add this
 * </ActionBarPrimitive.Root>
 * ```
 *
 * @param side - Side of the tooltip relative to the badge trigger.
 * @default "right"
 */
export const MessageTiming: FC<{
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}> = ({ className, side = "right" }) => {
  const timing = useMessageTiming();
  if (timing?.totalStreamTime === undefined) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={
          <button
            type="button"
            data-slot="message-timing-trigger"
            aria-label="Message timing"
            {...withClass(undefined, className, styles.trigger)}
          />
        }>{formatTimingMs(timing.totalStreamTime)}</TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={8}
          data-slot="message-timing-popover"
        >
          <div {...mark(undefined, styles.grid)}>
            {timing.firstTokenTime !== undefined && (
              <div {...mark(undefined, styles.row)}>
                <span {...mark(undefined, styles.label)}>First token</span>
                <span {...mark(undefined, styles.value)}>
                  {formatTimingMs(timing.firstTokenTime)}
                </span>
              </div>
            )}
            <div {...mark(undefined, styles.row)}>
              <span {...mark(undefined, styles.label)}>Total</span>
              <span {...mark(undefined, styles.value)}>
                {formatTimingMs(timing.totalStreamTime)}
              </span>
            </div>
            {timing.tokensPerSecond !== undefined && (
              <div {...mark(undefined, styles.row)}>
                <span {...mark(undefined, styles.label)}>Speed</span>
                <span {...mark(undefined, styles.value)}>
                  {timing.tokensPerSecond.toFixed(1)} tok/s
                </span>
              </div>
            )}
            <div {...mark(undefined, styles.row)}>
              <span {...mark(undefined, styles.label)}>Chunks</span>
              <span {...mark(undefined, styles.value)}>
                {timing.totalChunks}
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
