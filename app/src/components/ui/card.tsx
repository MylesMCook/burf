"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";


// Cards in Burf: one outline per section.
// - A section of a page is one Card, or a Frame with variant="card": its
//   header row and its rows sit directly inside, divided by a top border (or
//   divide on a list). Never put a bordered card inside another card.
// - A muted fill with no border is for what is quoted inside a section: a
//   transcript, a command's output, code.
// - The inset Frame (muted tray, raised panels) is for grouped inputs in a
//   dialog, not for page sections.
// - Column headers and small section labels are sentence case, 11px muted:
//   never uppercase or tracked.
// - State is never a stripe down one side of a card or row. Tint the whole
//   outline, or say it with a glyph or a word.

const styles = stylex.create({
  card: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.card,
    backgroundClip: "padding-box",
    color: color.cardForeground,
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-2xl) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
  },
  clip: { overflow: "hidden" },
  frame: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.card,
    backgroundClip: "padding-box",
    color: color.cardForeground,
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    "--clip-top": "-1rem",
    "--clip-bottom": "-1rem",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-2xl) - 1px)",
      backgroundColor: "color-mix(in oklab, var(--muted) 72%, transparent)",
      boxShadow: "var(--dialog-edge)",
    },
    ":has([data-slot=table-container])": { overflow: "hidden" },
    ":not(#\\#) > [data-slot=card]": {
      margin: -1,
      backgroundClip: "padding-box",
      boxShadow: "none",
      clipPath: "inset(var(--clip-top) 1px var(--clip-bottom) 1px round calc(var(--radius-2xl) - 1px))",
    },
    ":not(#\\#) > [data-slot=card]::before": { display: "none" },
    ":not(#\\#) > [data-slot=card]:not(:first-child)": {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
    },
    ":not(#\\#) > [data-slot=card]:not(:last-child)": {
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    ":not(#\\#) > [data-slot=card]:first-child": { "--clip-top": "1px" },
    ":not(#\\#) > [data-slot=card]:last-child": { "--clip-bottom": "1px" },
    ":not(#\\#) > [data-slot=table-container]": { margin: -1, width: "calc(100% + 2px)" },
  },
  frameHeader: {
    position: "relative",
    display: "grid",
    gridAutoRows: "min-content",
    gridTemplateRows: "auto auto",
    alignItems: "start",
    columnGap: 16,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 24,
    paddingRight: 24,
    gridTemplateColumns: { ":has([data-slot=card-frame-action])": "1fr auto" },
  },
  frameHeaderTight: { paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 },
  frameTitle: { alignSelf: "center", fontWeight: 600, fontSize: 14 },
  frameTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  frameDescription: { alignSelf: "center", color: color.mutedForeground, fontSize: 14 },
  frameDescriptionXs: { fontSize: 12 },
  frameAction: {
    gridColumnStart: 2,
    display: "inline-flex",
    alignSelf: "center",
    justifySelf: "end",
    ":nth-child(3)": { gridRowStart: 1, gridRowEnd: "span 2" },
  },
  frameFooter: { paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24 },
  frameFooterBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
  },
  header: {
    display: "grid",
    gridAutoRows: "min-content",
    gridTemplateRows: "auto auto",
    alignItems: "start",
    gap: 6,
    padding: 24,
    paddingBottom: {
      default: 24,
      ":is([data-slot=card]:has(> [data-slot=card-panel]) &)": 16,
    },
    gridTemplateColumns: { ":has([data-slot=card-action])": "1fr auto" },
  },
  title: { fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, lineHeight: 1 },
  description: { color: color.mutedForeground, fontSize: 14 },
  action: {
    gridColumnStart: 2,
    gridRowStart: 1,
    gridRowEnd: "span 2",
    display: "inline-flex",
    alignSelf: "start",
    justifySelf: "end",
  },
  panel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    padding: 24,
    paddingTop: { ":is([data-slot=card]:has(> [data-slot=card-header]) &)": 0 },
    paddingBottom: { ":is([data-slot=card]:has(> [data-slot=card-footer]) &)": 0 },
  },
  footer: {
    display: "flex",
    alignItems: "center",
    padding: 24,
    paddingTop: { ":is([data-slot=card]:has(> [data-slot=card-panel]) &)": 16 },
  },
});

type DivProps = Omit<useRender.ComponentProps<"div">, "className" | "style">;

function paint(slot: string, ...parts: readonly (false | null | undefined | object)[]) {
  const painted = (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string; style?: React.CSSProperties })(...parts);
  return {
    className: painted.className,
    style: painted.style,
    "data-slot": slot,
  };
}

export function Card({ clip = false, render, ...props }: DivProps & { clip?: boolean }): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card", styles.card, clip && styles.clip), props),
    render,
  });
}

export function CardFrame({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-frame", styles.frame), props),
    render,
  });
}

export function CardFrameHeader({
  pad = "default",
  render,
  ...props
}: DivProps & { pad?: "default" | "tight" }): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-frame-header", styles.frameHeader, pad === "tight" && styles.frameHeaderTight), props),
    render,
  });
}

export function CardFrameTitle({ row = false, render, ...props }: DivProps & { row?: boolean }): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-frame-title", styles.frameTitle, row && styles.frameTitleRow), props),
    render,
  });
}

export function CardFrameDescription({
  size = "sm",
  render,
  ...props
}: DivProps & { size?: "sm" | "xs" }): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-frame-description", styles.frameDescription, size === "xs" && styles.frameDescriptionXs), props),
    render,
  });
}

export function CardFrameAction({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-frame-action", styles.frameAction), props),
    render,
  });
}

export function CardFrameFooter({
  bar = false,
  render,
  ...props
}: DivProps & { bar?: boolean }): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-frame-footer", bar ? styles.frameFooterBar : styles.frameFooter), props),
    render,
  });
}

export function CardHeader({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-header", styles.header), props),
    render,
  });
}

export function CardTitle({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-title", styles.title), props),
    render,
  });
}

export function CardDescription({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-description", styles.description), props),
    render,
  });
}

export function CardAction({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-action", styles.action), props),
    render,
  });
}

export function CardPanel({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-panel", styles.panel), props),
    render,
  });
}

export function CardFooter({ render, ...props }: DivProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(paint("card-footer", styles.footer), props),
    render,
  });
}

export { CardPanel as CardContent };
