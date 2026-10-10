import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, font, radius } from "@/styles/tokens.stylex";

const md = "@media (min-width: 768px)";

const styles = stylex.create({
  root: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    textWrap: "balance",
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: { default: 48, [md]: 80 },
    paddingBottom: { default: 48, [md]: 80 },
    textAlign: "center",
  },
  panel: { borderRadius: radius.xl, borderWidth: 1, borderStyle: "solid", borderColor: color.border },
  room: { paddingTop: 64, paddingBottom: 64 },
  none: { padding: 0 },
  space10: { marginTop: 40 },
  space12: { marginTop: 48 },
  space16: { marginTop: 64 },
  measureMd: { maxWidth: "28rem" },
  measureXl: { maxWidth: "36rem" },
  fill: { height: "100%" },
  header: { display: "flex", maxWidth: "24rem", flexDirection: "column", alignItems: "center", textAlign: "center" },
  media: { position: "relative", marginBottom: 24 },
  mediaBox: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    ":not(#\\#) svg": { pointerEvents: "none", flexShrink: 0 },
  },
  icon: {
    position: "relative",
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.card,
    backgroundClip: "padding-box",
    color: color.foreground,
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-md) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
    ":not(#\\#) svg": { width: 18, height: 18 },
  },
  ghostLeft: {
    pointerEvents: "none",
    position: "absolute",
    bottom: 1,
    transformOrigin: "bottom left",
    transform: "translateX(-2px) rotate(-10deg) scale(0.84)",
    boxShadow: "none",
  },
  ghostRight: {
    pointerEvents: "none",
    position: "absolute",
    bottom: 1,
    transformOrigin: "bottom right",
    transform: "translateX(2px) rotate(10deg) scale(0.84)",
    boxShadow: "none",
  },
  title: { fontWeight: 600, fontSize: 20 },
  titleBase: { fontSize: 16 },
  description: {
    color: color.mutedForeground,
    fontSize: 14,
    ":is([data-slot='empty-title'] + &)": { marginTop: 4 },
    ":not(#\\#) > a": { textDecorationLine: "underline", textUnderlineOffset: 4 },
    ":not(#\\#) > a:hover": { color: color.primary },
  },
  descriptionXs: { fontSize: 12 },
  wrap: { whiteSpace: "pre-wrap" },
  mono: { fontFamily: font.mono },
  content: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    maxWidth: "24rem",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    textWrap: "balance",
    fontSize: 14,
  },
});

export type EmptyFrame = "plain" | "panel";
export type EmptyPad = "default" | "room" | "none";
export type EmptySpace = "10" | "12" | "16";
export type EmptyMeasure = "md" | "xl";

export function Empty({
  frame = "plain",
  pad = "default",
  space,
  measure,
  fill = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  frame?: EmptyFrame;
  pad?: EmptyPad;
  space?: EmptySpace;
  measure?: EmptyMeasure;
  fill?: boolean;
}): React.ReactElement {
  return (
    <div
      className={stylex.props(
        styles.root,
        frame === "panel" && styles.panel,
        pad === "room" && styles.room,
        pad === "none" && styles.none,
        space === "10" && styles.space10,
        space === "12" && styles.space12,
        space === "16" && styles.space16,
        measure === "md" && styles.measureMd,
        measure === "xl" && styles.measureXl,
        fill && styles.fill,
      ).className}
      data-slot="empty"
      {...props}
    />
  );
}

export function EmptyHeader(props: Omit<React.ComponentProps<"div">, "className">): React.ReactElement {
  return <div className={stylex.props(styles.header).className} data-slot="empty-header" {...props} />;
}

export function EmptyMedia({
  variant = "default",
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { variant?: "default" | "icon" }): React.ReactElement {
  const box = stylex.props(styles.mediaBox, variant === "icon" && styles.icon).className;
  return (
    <div className={stylex.props(styles.media).className} data-slot="empty-media" data-variant={variant} {...props}>
      {variant === "icon" && (
        <>
          <div aria-hidden="true" className={stylex.props(styles.mediaBox, styles.icon, styles.ghostLeft).className} />
          <div aria-hidden="true" className={stylex.props(styles.mediaBox, styles.icon, styles.ghostRight).className} />
        </>
      )}
      <div className={box}>{children}</div>
    </div>
  );
}

export function EmptyTitle({
  size = "xl",
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { size?: "xl" | "base" }): React.ReactElement {
  return <div className={stylex.props(styles.title, size === "base" && styles.titleBase).className} data-slot="empty-title" {...props} />;
}

export function EmptyDescription({
  size = "sm",
  measure,
  wrap = false,
  mono = false,
  ...props
}: Omit<React.ComponentProps<"p">, "className"> & {
  size?: "sm" | "xs";
  measure?: "md";
  wrap?: boolean;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div
      className={stylex.props(
        styles.description,
        size === "xs" && styles.descriptionXs,
        measure === "md" && styles.measureMd,
        wrap && styles.wrap,
        mono && styles.mono,
      ).className}
      data-slot="empty-description"
      {...props}
    />
  );
}

export function EmptyContent(props: Omit<React.ComponentProps<"div">, "className">): React.ReactElement {
  return <div className={stylex.props(styles.content).className} data-slot="empty-content" {...props} />;
}
