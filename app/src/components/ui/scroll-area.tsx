"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { radius } from "@/styles/tokens.stylex";

const still = "@media (prefers-reduced-motion: reduce)";

const fadeMask = [
  "linear-gradient(to top, black calc(100% - min(var(--fade-size), var(--scroll-area-overflow-y-start, 0px))), transparent)",
  "linear-gradient(to bottom, black calc(100% - min(var(--fade-size), var(--scroll-area-overflow-y-end, 0px))), transparent)",
  "linear-gradient(to left, black calc(100% - min(var(--fade-size), var(--scroll-area-overflow-x-start, 0px))), transparent)",
  "linear-gradient(to right, black calc(100% - min(var(--fade-size), var(--scroll-area-overflow-x-end, 0px))), transparent)",
].join(", ");

const styles = stylex.create({
  root: { width: "100%", height: "100%", minHeight: 0 },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  viewport: {
    height: "100%",
    borderRadius: "inherit",
    outline: "none",
    transitionProperty: "box-shadow",
    transitionDuration: { default: "150ms", [still]: "0s" },
    boxShadow: { ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)" },
  },
  containY: { overscrollBehaviorY: "contain" },
  containX: { overscrollBehaviorX: "contain" },
  gutterY: { paddingInlineEnd: 10 },
  gutterX: { paddingBottom: 10 },
  fade: {
    "--fade-size": "1.5rem",
    maskImage: fadeMask,
    maskComposite: "intersect",
  },
  cap: { maxHeight: "var(--list-max)" },
  fill: { width: "100%", height: "100%" },
  clamp: { minWidth: 0 },
  bar: {
    margin: 4,
    display: "flex",
    opacity: 0,
    transitionProperty: "opacity",
    transitionDelay: { default: "300ms", [still]: "0s" },
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  barOn: { opacity: 1, transitionDelay: "0s", transitionDuration: "100ms" },
  barY: { width: 6 },
  barX: { height: 6, flexDirection: "column" },
  thumb: {
    position: "relative",
    flexGrow: 1,
    borderRadius: radius.full,
    backgroundColor: "color-mix(in oklab, var(--foreground) 20%, transparent)",
  },
});

export function ScrollArea({
  children,
  scrollFade = false,
  scrollbarGutter = false,
  fill = false,
  clampContentMinWidth = true,
  overscrollContain = false,
  grow = false,
  cap = false,
  ...props
}: Omit<ScrollAreaPrimitive.Root.Props, "className"> & {
  scrollFade?: boolean;
  scrollbarGutter?: boolean;
  fill?: boolean;
  clampContentMinWidth?: boolean;
  overscrollContain?: boolean;
  grow?: boolean;
  cap?: boolean;
}): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Root className={stylex.props(styles.root, grow && styles.grow).className} {...props}>
      <ScrollAreaPrimitive.Viewport
        className={(state) =>
          stylex.props(
            styles.viewport,
            overscrollContain && state.hasOverflowY && styles.containY,
            overscrollContain && state.hasOverflowX && styles.containX,
            scrollFade && styles.fade,
            cap && styles.cap,
            scrollbarGutter && state.hasOverflowY && styles.gutterY,
            scrollbarGutter && state.hasOverflowX && styles.gutterX,
          ).className
        }
        data-slot="scroll-area-viewport"
      >
        <ScrollAreaPrimitive.Content className={stylex.props(fill && styles.fill, clampContentMinWidth && styles.clamp).className} data-slot="scroll-area-content">
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  orientation = "vertical",
  ...props
}: Omit<ScrollAreaPrimitive.Scrollbar.Props, "className" | "style">): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={(state) =>
        stylex.props(
          styles.bar,
          state.orientation === "horizontal" ? styles.barX : styles.barY,
          (state.hovering || state.scrolling) && styles.barOn,
        ).className
      }
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className={stylex.props(styles.thumb).className} data-slot="scroll-area-thumb" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollAreaPrimitive };
