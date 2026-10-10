import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const styles = stylex.create({
  inset: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderRadius: radius.xxl,
    backgroundColor: "color-mix(in oklab, var(--muted) 72%, transparent)",
    padding: 4,
    ":not(#\\#) > [data-slot=frame-panel] + [data-slot=frame-panel]": { marginTop: 4 },
  },
  card: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.card,
    color: color.cardForeground,
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    ":not(#\\#) > [data-slot=frame-panel]": {
      borderRadius: 0,
      borderWidth: 0,
      backgroundColor: "transparent",
      boxShadow: "none",
    },
    ":not(#\\#) > [data-slot=frame-panel]::before": { display: "none" },
    ":not(#\\#) > [data-slot=frame-panel] + [data-slot=frame-panel]": {
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderTopColor: color.border,
    },
    ":not(#\\#) > [data-slot=frame-panel-footer]": {
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderTopColor: color.border,
    },
  },
  radiusXl: { borderRadius: radius.xl },
  tray: { padding: 2 },
  full: { width: "100%" },
  lift: { boxShadow: "0 10px 15px -3px color-mix(in oklab, var(--foreground) 5%, transparent)" },
  dragging: {
    outlineWidth: 2,
    outlineStyle: "dashed",
    outlineColor: "color-mix(in oklab, var(--ring) 60%, transparent)",
    outlineOffset: 4,
  },
  panel: {
    position: "relative",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.background,
    backgroundClip: "padding-box",
    padding: 20,
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-xl) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
  },
  padNone: { padding: 0 },
  padRoom: { padding: 16 },
  padField: { paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 },
  padText: { paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16 },
  padCompact: { padding: 14 },
  padCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 32,
    paddingRight: 32,
    textAlign: "center",
  },
  stack: { display: "flex", flexDirection: "column" },
  gap1: { gap: 4 },
  gap2: { gap: 8 },
  gap3: { gap: 12 },
  gap4: { gap: 16 },
  scroll: { maxHeight: "min(46vh, 30rem)", overflowY: "auto" },
  drop: { marginBottom: 4 },
  tall: { display: "flex", height: "30rem", minHeight: 0, overflow: "hidden" },
  bare: {
    borderRadius: 10,
    padding: 0,
    boxShadow: "none",
    backgroundColor: "var(--well-fill)",
    "::before": { display: "none" },
  },
  focus: {
    borderColor: { ":has(textarea:focus-visible)": color.ring },
    boxShadow: { ":has(textarea:focus-visible)": "0 0 0 3px color-mix(in oklab, var(--ring) 24%, transparent)" },
  },
  tone: { color: color.mutedForeground, fontSize: 14 },
  space3: { display: "flex", flexDirection: "column", gap: 12 },
  space4: { display: "flex", flexDirection: "column", gap: 16 },
  header: { display: "flex", flexDirection: "column", paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20 },
  row: { flexDirection: "row", alignItems: "center" },
  wrap: { flexWrap: "wrap" },
  headTight: { paddingTop: 12, paddingBottom: 12 },
  headSnug: { paddingTop: 10, paddingBottom: 10 },
  headBar: { paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16 },
  headShort: { paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 },
  title: { fontWeight: 600, fontSize: 14 },
  titleRow: { display: "flex", alignItems: "center", gap: 8 },
  title13: { fontWeight: 500, fontSize: 13 },
  truncate: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  description: { color: color.mutedForeground, fontSize: 14 },
  footer: { paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20 },
  footerBar: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: 2,
    paddingTop: 4,
    paddingRight: 4,
    paddingBottom: 0,
    paddingLeft: 4,
  },
});

export type FramePanelPad = "default" | "none" | "room" | "field" | "text" | "compact" | "center";
export type FrameHeaderPad = "default" | "tight" | "snug" | "bar" | "short";

export function Frame({
  variant = "inset",
  radius: curve,
  tray = false,
  lift = false,
  dragging = false,
  width,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  variant?: "inset" | "card";
  radius?: "xl";
  tray?: boolean;
  lift?: boolean;
  dragging?: boolean;
  width?: "full";
}): React.ReactElement {
  return (
    <div
      className={stylex.props(
        variant === "card" ? styles.card : styles.inset,
        curve === "xl" && styles.radiusXl,
        tray && styles.tray,
        width === "full" && styles.full,
        lift && styles.lift,
        dragging && styles.dragging,
      ).className}
      data-slot="frame"
      data-variant={variant}
      {...props}
    />
  );
}

export function FramePanel({
  pad = "default",
  stack = false,
  gap,
  scroll = false,
  drop = false,
  tall = false,
  bare = false,
  focus = false,
  tone = false,
  space,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  pad?: FramePanelPad;
  stack?: boolean;
  gap?: 1 | 2 | 3 | 4;
  scroll?: boolean;
  drop?: boolean;
  tall?: boolean;
  bare?: boolean;
  focus?: boolean;
  tone?: boolean;
  space?: 3 | 4;
}): React.ReactElement {
  return (
    <div
      className={stylex.props(
        styles.panel,
        pad === "none" && styles.padNone,
        pad === "room" && styles.padRoom,
        pad === "field" && styles.padField,
        pad === "text" && styles.padText,
        pad === "compact" && styles.padCompact,
        pad === "center" && styles.padCenter,
        stack && styles.stack,
        gap === 1 && styles.gap1,
        gap === 2 && styles.gap2,
        gap === 3 && styles.gap3,
        gap === 4 && styles.gap4,
        scroll && styles.scroll,
        drop && styles.drop,
        tall && styles.tall,
        bare && styles.bare,
        focus && styles.focus,
        tone && styles.tone,
        space === 3 && styles.space3,
        space === 4 && styles.space4,
      ).className}
      data-slot="frame-panel"
      {...props}
    />
  );
}

export function FrameHeader({
  row = false,
  wrap = false,
  gap,
  pad = "default",
  ...props
}: Omit<React.ComponentProps<"header">, "className"> & {
  row?: boolean;
  wrap?: boolean;
  gap?: 1 | 2;
  pad?: FrameHeaderPad;
}): React.ReactElement {
  return (
    <header
      className={stylex.props(
        styles.header,
        row && styles.row,
        wrap && styles.wrap,
        gap === 1 && styles.gap1,
        gap === 2 && styles.gap2,
        pad === "tight" && styles.headTight,
        pad === "snug" && styles.headSnug,
        pad === "bar" && styles.headBar,
        pad === "short" && styles.headShort,
      ).className}
      data-slot="frame-panel-header"
      {...props}
    />
  );
}

export function FrameTitle({
  row = false,
  size = "sm",
  truncate = false,
  grow = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  row?: boolean;
  size?: "sm" | "13";
  truncate?: boolean;
  grow?: boolean;
}): React.ReactElement {
  return (
    <div
      className={stylex.props(styles.title, row && styles.titleRow, size === "13" && styles.title13, truncate && styles.truncate, grow && styles.grow).className}
      data-slot="frame-panel-title"
      {...props}
    />
  );
}

export function FrameDescription({
  truncate = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { truncate?: boolean }): React.ReactElement {
  return <div className={stylex.props(styles.description, truncate && styles.truncate).className} data-slot="frame-panel-description" {...props} />;
}

export function FrameFooter({
  bar = false,
  ...props
}: Omit<React.ComponentProps<"footer">, "className"> & { bar?: boolean }): React.ReactElement {
  return <footer className={stylex.props(styles.footer, bar && styles.footerBar).className} data-slot="frame-panel-footer" {...props} />;
}
