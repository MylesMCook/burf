"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const wide = "@media (min-width: 1201px)";

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
    textWrap: "balance",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    color: color.popoverForeground,
    fontSize: 12,
    boxShadow: "0 4px 8px color-mix(in oklab, var(--foreground) 5%, transparent)",
    transitionProperty: "width, height, scale, opacity",
  },
  motion: {
    opacity: 0,
    scale: 0.98,
  },
  viewport: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "clip",
    overflowWrap: "anywhere",
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
  },
  sm: { maxWidth: 384 },
  md: { maxWidth: 448 },
  lg: { maxWidth: 512 },
  xs: { maxWidth: 320 },
  w72: { maxWidth: 288 },
  none: { maxWidth: "none" },
  narrow: { display: { default: "flex", [wide]: "none" } },
});

export type TooltipWidth = "xs" | "sm" | "md" | "lg" | "72" | "none";

const widthStyle = {
  xs: styles.xs,
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  "72": styles.w72,
  none: styles.none,
} as const;

export const TooltipCreateHandle: typeof TooltipPrimitive.createHandle = TooltipPrimitive.createHandle;
export const TooltipProvider: typeof TooltipPrimitive.Provider = TooltipPrimitive.Provider;

// A tooltip opens on focus only when the keyboard moved focus there
// (Tab, arrows). Focus put back by code (a popover closing onto its
// trigger, a sheet's first button) leaves it shut, so it never covers what
// just appeared.
let lastNav = 0;
if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Tab" || e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") lastNav = Date.now();
    },
    true,
  );
}

// focusFromKeyboard says whether the keyboard just moved focus, for
// tooltips that open on focus without a trigger of their own (tip.tsx).
export const focusFromKeyboard = () => Date.now() - lastNav <= 600;

export function Tooltip({ onOpenChange, ...props }: TooltipPrimitive.Root.Props): React.ReactElement {
  return (
    <TooltipPrimitive.Root
      {...props}
      onOpenChange={(open, details) => {
        if (open && details.reason === "trigger-focus" && Date.now() - lastNav > 600) details.cancel();
        onOpenChange?.(open, details);
      }}
    />
  );
}

export function TooltipTrigger(props: TooltipPrimitive.Trigger.Props): React.ReactElement {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export function TooltipPopup({
  align = "center",
  sideOffset = 4,
  side = "top",
  anchor,
  children,
  portalProps,
  width,
  narrow = false,
  ...props
}: Omit<TooltipPrimitive.Popup.Props, "className" | "style"> & {
  align?: TooltipPrimitive.Positioner.Props["align"];
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
  anchor?: TooltipPrimitive.Positioner.Props["anchor"];
  portalProps?: TooltipPrimitive.Portal.Props;
  width?: TooltipWidth;
  /** Hide the popup once the window is wider than the settings rail. */
  narrow?: boolean;
}): React.ReactElement {
  const positioner = stylex.props(styles.positioner);
  return (
    <TooltipPrimitive.Portal {...portalProps}>
      <TooltipPrimitive.Positioner
        align={align}
        anchor={anchor}
        className={positioner.className}
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={(state) =>
            stylex.props(
              styles.popup,
              width && widthStyle[width],
              narrow && styles.narrow,
              (state.transitionStatus === "starting" || state.transitionStatus === "ending") && styles.motion,
              state.instant && styles.instant,
            ).className
          }
          data-slot="tooltip-popup"
          {...props}
        >
          <TooltipPrimitive.Viewport className={stylex.props(styles.viewport).className} data-slot="tooltip-viewport">
            {children}
          </TooltipPrimitive.Viewport>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { TooltipPrimitive, TooltipPopup as TooltipContent };
