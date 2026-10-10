"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as stylex from "@stylexjs/stylex";
import type React from "react";
import { FocusRescue } from "@/lib/focus-home";
import { color, radius } from "@/styles/tokens.stylex";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  positioner: {
    zIndex: 50,
    height: "var(--positioner-height)",
    width: "var(--positioner-width)",
    maxWidth: "var(--available-width)",
    transitionProperty: "top, left, right, bottom, transform",
  },
  instant: { transitionDuration: "0s" },
  popup: {
    position: "relative",
    display: "flex",
    height: "var(--popup-height, auto)",
    width: "var(--popup-width, auto)",
    transformOrigin: "var(--transform-origin)",
    borderRadius: {
      default: radius.lg,
      ":has([data-slot='calendar'])": radius.xl,
    },
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    color: color.popoverForeground,
    boxShadow: "0 10px 15px -3px color-mix(in oklab, var(--foreground) 5%, transparent)",
    outline: "none",
    transitionProperty: "width, height, scale, opacity",
    transitionDuration: { default: "200ms", [still]: "0s" },
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: {
        default: "calc(var(--radius-lg) - 1px)",
        ":has([data-slot='calendar'])": "calc(var(--radius-xl) - 1px)",
      },
      boxShadow: "var(--dialog-edge)",
    },
  },
  fade: { opacity: 0, scale: 0.98 },
  tip: {
    width: "fit-content",
    textWrap: "balance",
    borderRadius: radius.md,
    fontSize: 12,
    boxShadow: "0 4px 6px color-mix(in oklab, var(--foreground) 5%, transparent)",
    "::before": { borderRadius: "calc(var(--radius-md) - 1px)" },
  },
  w26: { width: "26rem" },
  w32: { width: "32rem", maxWidth: "calc(100vw - 2rem)" },
  w88: { width: "22rem" },
  w72: {
    width: "18rem",
    minWidth: "var(--anchor-width)",
    overflow: "hidden",
    borderRadius: radius.xl,
  },
  wFit: { width: "min(28rem, var(--available-width))" },
  viewport: {
    position: "relative",
    width: "100%",
    height: "100%",
    maxHeight: "var(--available-height)",
    overflow: "clip",
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 16,
  },
  viewportScroll: { overflowY: "auto" },
  viewportTip: { paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 },
  viewportFlush: { padding: 0 },
  viewportCalendar: {
    padding: { ":has([data-slot='calendar'])": 8 },
  },
  title: { fontWeight: 600, fontSize: 18, lineHeight: 1 },
  description: { color: color.mutedForeground, fontSize: 14 },
});

export type PopoverWidth = "26" | "32" | "72" | "88" | "fit";

const widthStyle = {
  "26": styles.w26,
  "32": styles.w32,
  "88": styles.w88,
  "72": styles.w72,
  fit: styles.wFit,
} as const;

export const PopoverCreateHandle: typeof PopoverPrimitive.createHandle = PopoverPrimitive.createHandle;
export const Popover: typeof PopoverPrimitive.Root = PopoverPrimitive.Root;

export function PopoverTrigger({
  className,
  children,
  ...props
}: PopoverPrimitive.Trigger.Props): React.ReactElement {
  return (
    <PopoverPrimitive.Trigger className={className} data-slot="popover-trigger" {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  );
}

export function PopoverPopup({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  tooltipStyle = false,
  anchor,
  portalProps,
  width,
  flush = false,
  ...props
}: Omit<PopoverPrimitive.Popup.Props, "className"> & {
  portalProps?: PopoverPrimitive.Portal.Props;
  side?: PopoverPrimitive.Positioner.Props["side"];
  align?: PopoverPrimitive.Positioner.Props["align"];
  sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: PopoverPrimitive.Positioner.Props["alignOffset"];
  tooltipStyle?: boolean;
  anchor?: PopoverPrimitive.Positioner.Props["anchor"];
  width?: PopoverWidth;
  flush?: boolean;
}): React.ReactElement {
  return (
    <PopoverPrimitive.Portal {...portalProps}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className={(state) => stylex.props(styles.positioner, state.instant != null && styles.instant).className}
        data-slot="popover-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={(state) =>
            stylex.props(
              styles.popup,
              tooltipStyle && styles.tip,
              width && widthStyle[width],
              (state.transitionStatus === "starting" || state.transitionStatus === "ending") && styles.fade,
              state.instant != null && styles.instant,
            ).className
          }
          data-slot="popover-popup"
          {...props}
        >
          <FocusRescue />
          <PopoverPrimitive.Viewport
            className={(state) =>
              stylex.props(
                styles.viewport,
                styles.viewportCalendar,
                tooltipStyle ? styles.viewportTip : !state.transitioning && styles.viewportScroll,
                flush && styles.viewportFlush,
                state.instant != null && styles.instant,
              ).className
            }
            data-slot="popover-viewport"
          >
            {children}
          </PopoverPrimitive.Viewport>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export function PopoverClose(props: PopoverPrimitive.Close.Props): React.ReactElement {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

export function PopoverTitle(props: Omit<PopoverPrimitive.Title.Props, "className" | "style">): React.ReactElement {
  return <PopoverPrimitive.Title className={stylex.props(styles.title).className} data-slot="popover-title" {...props} />;
}

export function PopoverDescription(props: Omit<PopoverPrimitive.Description.Props, "className" | "style">): React.ReactElement {
  return <PopoverPrimitive.Description className={stylex.props(styles.description).className} data-slot="popover-description" {...props} />;
}

export { PopoverPrimitive, PopoverPopup as PopoverContent };
