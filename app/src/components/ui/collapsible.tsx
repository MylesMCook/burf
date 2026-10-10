"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  full: { width: "100%" },
  tool: { width: "100%", maxWidth: "24rem" },
  below: { marginBottom: 16 },
  space: { marginTop: 12 },
  section: { paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 },
  outline: { borderRadius: radius.lg, borderWidth: 1, borderStyle: "solid", borderColor: color.border },
  muted: { borderRadius: radius.lg, backgroundColor: "color-mix(in oklab, var(--muted) 50%, transparent)" },
  tint: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--muted) 30%, transparent)",
  },
  padText: { paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 },
  padBlock: { paddingTop: 12, paddingBottom: 12 },
  panel: {
    position: "relative",
    height: "var(--collapsible-panel-height)",
    overflow: "hidden",
    outline: "none",
    transitionProperty: "height",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  shut: { height: 0, pointerEvents: "none" },
  textSm: { fontSize: 14 },
  toneMuted: { color: color.mutedForeground },
  row: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm,
    textAlign: "left",
    fontSize: 14,
    outline: "none",
    boxShadow: { ":focus-visible": "0 0 0 2px var(--ring)" },
  },
  quiet: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.md,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 4,
    paddingRight: 4,
    fontWeight: 500,
    fontSize: 13,
    color: { default: color.mutedForeground, ":hover": color.foreground },
    outline: "none",
    boxShadow: { ":focus-visible": "0 0 0 2px var(--ring)" },
  },
  toolRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingTop: 4,
    paddingBottom: 4,
    fontSize: 13.5,
    color: {
      default: "color-mix(in oklab, var(--foreground) 55%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    },
    outline: "none",
  },
  status: {
    display: "flex",
    width: "fit-content",
    transformOrigin: "left",
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
    paddingBottom: 6,
    fontSize: 14,
    color: { default: color.mutedForeground, ":hover": color.foreground },
    scale: { ":active": 0.98 },
    transitionProperty: "color, scale",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  reason: { maxWidth: "75%" },
  bundle: {
    display: "flex",
    transformOrigin: "left",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    scale: { ":active": 0.98 },
    transitionProperty: "color, scale",
    transitionDuration: { default: "150ms", [still]: "0s" },
    color: {
      ":is([data-variant='ghost'] > &)": color.mutedForeground,
      ":is([data-variant='ghost'] > &):hover": color.foreground,
    },
    paddingTop: { ":is([data-variant='ghost'] > &)": 6 },
    paddingBottom: { ":is([data-variant='ghost'] > &)": 6 },
    width: { ":is([data-variant='outline'] > &)": "100%", ":is([data-variant='muted'] > &)": "100%" },
    paddingLeft: { ":is([data-variant='outline'] > &)": 16, ":is([data-variant='muted'] > &)": 16 },
    paddingRight: { ":is([data-variant='outline'] > &)": 16, ":is([data-variant='muted'] > &)": 16 },
  },
});

export type CollapsibleChrome = "none" | "outline" | "muted" | "tint";
export type CollapsiblePad = "none" | "text" | "block";
export type CollapsibleWidth = "full" | "tool";
export type CollapsibleLook = "row" | "quiet" | "tool" | "status" | "reason" | "bundle";

const chromeStyle = { none: null, outline: styles.outline, muted: styles.muted, tint: styles.tint } as const;
const padStyle = { none: null, text: styles.padText, block: styles.padBlock } as const;
const lookStyle = { row: styles.row, quiet: styles.quiet, tool: styles.toolRow, status: styles.status, reason: styles.status, bundle: styles.bundle } as const;

function join(visual: string | undefined, marker?: string): string | undefined {
  if (!marker) return visual;
  return visual ? `${visual} ${marker}` : marker;
}

export function Collapsible({
  chrome = "none",
  pad = "none",
  width,
  below = false,
  space = false,
  section = false,
  marker,
  ...props
}: Omit<CollapsiblePrimitive.Root.Props, "className"> & {
  chrome?: CollapsibleChrome;
  pad?: CollapsiblePad;
  width?: CollapsibleWidth;
  below?: boolean;
  space?: boolean;
  section?: boolean;
  marker?: string;
}): React.ReactElement {
  return (
    <CollapsiblePrimitive.Root
      className={join(
        stylex.props(
          width === "full" && styles.full,
          width === "tool" && styles.tool,
          below && styles.below,
          space && styles.space,
          section && styles.section,
          chromeStyle[chrome],
          padStyle[pad],
        ).className,
        marker,
      )}
      data-slot="collapsible"
      {...props}
    />
  );
}

export function CollapsibleTrigger({
  look,
  marker,
  ...props
}: Omit<CollapsiblePrimitive.Trigger.Props, "className" | "style"> & {
  look?: CollapsibleLook;
  marker?: string;
}): React.ReactElement {
  return (
    <CollapsiblePrimitive.Trigger
      className={join(stylex.props(look && lookStyle[look], look === "reason" && styles.reason).className, marker)}
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

export function CollapsiblePanel({
  marker,
  text,
  tone,
  ...props
}: Omit<CollapsiblePrimitive.Panel.Props, "className" | "style"> & {
  marker?: string;
  text?: "sm";
  tone?: "muted";
}): React.ReactElement {
  return (
    <CollapsiblePrimitive.Panel
      className={(state) =>
        join(
          stylex.props(
            styles.panel,
            (state.transitionStatus === "starting" || state.transitionStatus === "ending") && styles.shut,
            text === "sm" && styles.textSm,
            tone === "muted" && styles.toneMuted,
          ).className,
          marker,
        )
      }
      data-slot="collapsible-panel"
      {...props}
    />
  );
}

export { CollapsiblePrimitive, CollapsiblePanel as CollapsibleContent };
