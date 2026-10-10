"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import { XIcon } from "lucide-react";
import type React from "react";
import { FocusRescue } from "@/lib/focus-home";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";
const narrow = "@media (max-width: 639px)";
const still = "@media (prefers-reduced-motion: reduce)";
const overPanel = ":is([data-slot='sheet-popup']:has([data-slot='sheet-panel']) > &)";
const underHeader = ":is([data-slot='sheet-popup']:has([data-slot='sheet-header']) > &)";
const overBareFooter = ":is([data-slot='sheet-popup']:has([data-slot='sheet-footer'][data-variant='bare']) > &)";

const styles = stylex.create({
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    backgroundColor: "color-mix(in oklab, black 32%, transparent)",
    backdropFilter: "blur(8px)",
    transitionProperty: "opacity",
    transitionDuration: { default: "200ms", [still]: "0s" },
  },
  gone: { opacity: 0 },
  viewport: { position: "fixed", inset: 0, zIndex: 50, display: "grid" },
  bottom: { gridTemplateRows: "1fr auto", paddingTop: 48 },
  top: { gridTemplateRows: "auto 1fr", paddingBottom: 48 },
  left: { display: "flex", justifyContent: "flex-start" },
  right: { display: "flex", justifyContent: "flex-end" },
  insetView: { padding: { [sm]: 16 } },
  popup: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    maxHeight: "100%",
    minHeight: 0,
    width: "100%",
    minWidth: 0,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    color: color.popoverForeground,
    boxShadow: "0 10px 15px -3px color-mix(in oklab, var(--foreground) 5%, transparent)",
    transitionProperty: "opacity, translate",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "ease-in-out",
    willChange: "transform",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      boxShadow: { default: "var(--dialog-edge)", [narrow]: "none" },
    },
  },
  sideBottom: { gridRowStart: 2, borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: color.border },
  sideTop: { borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: color.border },
  sideLeft: {
    width: "calc(100% - 3rem)",
    maxWidth: "28rem",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: color.border,
  },
  sideRight: {
    width: "calc(100% - 3rem)",
    maxWidth: "28rem",
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: color.border,
  },
  shiftY: { translate: "0 32px" },
  shiftYUp: { translate: "0 -32px" },
  shiftX: { translate: "32px 0" },
  shiftXOut: { translate: "-32px 0" },
  widthSm: { maxWidth: "24rem" },
  width512: { width: "min(512px, 100vw)", maxWidth: "none" },
  widthHistory: { width: "clamp(20rem, calc(100vw - 46rem), 45rem)", maxWidth: "none" },
  sidebar: {
    width: "18rem",
    maxWidth: "18rem",
    padding: 0,
    backgroundColor: color.sidebar,
    color: color.sidebarForeground,
  },
  notices: {
    outline: "none",
    height: { [sm]: "auto" },
    maxHeight: { [sm]: "calc(100% - 26px)" },
    maxWidth: { [sm]: 420 },
    alignSelf: { [sm]: "start" },
  },
  inset: {
    "::before": { display: { [sm]: "none" } },
    borderRadius: { [sm]: radius.xxl },
    borderWidth: { [sm]: 1 },
    borderStyle: { [sm]: "solid" },
    borderColor: { [sm]: color.border },
  },
  close: { position: "absolute", top: 8, insetInlineEnd: 8 },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 24,
    paddingBottom: { default: 24, [narrow]: 16, [overPanel]: 12 },
  },
  headerTight: { gap: 6 },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  footer: {
    display: "flex",
    flexDirection: { default: "column-reverse", [sm]: "row" },
    gap: 8,
    paddingLeft: 24,
    paddingRight: 24,
    justifyContent: { default: "flex-start", [sm]: "flex-end" },
  },
  band: {
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    backgroundColor: "color-mix(in oklab, var(--muted) 72%, transparent)",
    paddingTop: 16,
    paddingBottom: 16,
  },
  bare: { paddingTop: { default: 16, [overPanel]: 12 }, paddingBottom: 24 },
  title: { fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 20, lineHeight: 1 },
  titleBase: { fontSize: 16 },
  titleSm: { fontSize: 14 },
  titleRow: { display: "flex", alignItems: "center", gap: 8 },
  description: { color: color.mutedForeground, fontSize: 14 },
  descriptionStack: { display: "flex", flexDirection: "column", gap: 4 },
  panel: {
    paddingTop: { default: 24, [underHeader]: 4 },
    paddingRight: 24,
    paddingBottom: { default: 24, [overBareFooter]: 4 },
    paddingLeft: 24,
  },
  stack: { display: "flex", flexDirection: "column" },
  gap4: { gap: 16 },
  gap5: { gap: 20 },
  container: { containerType: "inline-size" },
  padTop: { paddingTop: 8 },
});

export type SheetSide = "right" | "left" | "top" | "bottom";
export type SheetWidth = "sm" | "md" | "512" | "history";
export type SheetTone = "default" | "sidebar" | "notices";

const sideStyle = {
  bottom: styles.sideBottom,
  top: styles.sideTop,
  left: styles.sideLeft,
  right: styles.sideRight,
} as const;

const viewStyle = {
  bottom: styles.bottom,
  top: styles.top,
  left: styles.left,
  right: styles.right,
} as const;

function moving(status: string | undefined): boolean {
  return status === "starting" || status === "ending";
}

export const Sheet: typeof SheetPrimitive.Root = SheetPrimitive.Root;
export const SheetPortal: typeof SheetPrimitive.Portal = SheetPrimitive.Portal;

export function SheetTrigger(props: SheetPrimitive.Trigger.Props): React.ReactElement {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

export function SheetClose(props: SheetPrimitive.Close.Props): React.ReactElement {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

export function SheetBackdrop(props: Omit<SheetPrimitive.Backdrop.Props, "className" | "style">): React.ReactElement {
  return (
    <SheetPrimitive.Backdrop
      className={(state) => stylex.props(styles.backdrop, moving(state.transitionStatus) && styles.gone).className}
      data-slot="sheet-backdrop"
      {...props}
    />
  );
}

export function SheetViewport({
  side = "right",
  variant = "default",
  ...props
}: Omit<SheetPrimitive.Viewport.Props, "className" | "style"> & {
  side?: SheetSide;
  variant?: "default" | "inset";
}): React.ReactElement {
  return (
    <SheetPrimitive.Viewport
      className={stylex.props(styles.viewport, viewStyle[side], variant === "inset" && styles.insetView).className}
      data-slot="sheet-viewport"
      {...props}
    />
  );
}

export function SheetPopup({
  children,
  showCloseButton = true,
  side = "right",
  variant = "default",
  closeProps,
  portalProps,
  width = "md",
  tone = "default",
  ...props
}: Omit<SheetPrimitive.Popup.Props, "className" | "style"> & {
  showCloseButton?: boolean;
  side?: SheetSide;
  variant?: "default" | "inset";
  closeProps?: Omit<SheetPrimitive.Close.Props, "className" | "style">;
  portalProps?: SheetPrimitive.Portal.Props;
  width?: SheetWidth;
  tone?: SheetTone;
}): React.ReactElement {
  return (
    <SheetPortal {...portalProps}>
      <SheetBackdrop />
      <SheetViewport side={side} variant={variant}>
        <SheetPrimitive.Popup
          className={(state) => {
            const start = moving(state.transitionStatus);
            return stylex.props(
              styles.popup,
              sideStyle[side],
              start && side === "bottom" && styles.shiftY,
              start && side === "top" && styles.shiftYUp,
              start && side === "left" && styles.shiftXOut,
              start && side === "right" && styles.shiftX,
              width === "sm" && styles.widthSm,
              width === "512" && styles.width512,
              width === "history" && styles.widthHistory,
              tone === "sidebar" && styles.sidebar,
              tone === "notices" && styles.notices,
              variant === "inset" && styles.inset,
            ).className;
          }}
          data-slot="sheet-popup"
          {...props}
        >
          <FocusRescue />
          {children}
          {showCloseButton && (
            <span className={stylex.props(styles.close).className}>
              <SheetPrimitive.Close aria-label="Close" render={<Button size="icon" variant="ghost" />} {...closeProps}>
                <XIcon />
              </SheetPrimitive.Close>
            </span>
          )}
        </SheetPrimitive.Popup>
      </SheetViewport>
    </SheetPortal>
  );
}

export function SheetHeader({
  pad = "default",
  hidden = false,
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className" | "style"> & {
  pad?: "default" | "tight";
  hidden?: boolean;
}): React.ReactElement {
  const defaultProps = {
    className: stylex.props(styles.header, pad === "tight" && styles.headerTight, hidden && styles.srOnly).className,
    "data-slot": "sheet-header",
  };
  return useRender({ defaultTagName: "div", props: mergeProps<"div">(defaultProps, props), render });
}

export function SheetFooter({
  variant = "default",
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className" | "style"> & {
  variant?: "default" | "bare";
}): React.ReactElement {
  const defaultProps = {
    className: stylex.props(styles.footer, variant === "default" && styles.band, variant === "bare" && styles.bare).className,
    "data-slot": "sheet-footer",
    "data-variant": variant,
  };
  return useRender({ defaultTagName: "div", props: mergeProps<"div">(defaultProps, props), render });
}

export function SheetTitle({
  size = "xl",
  row = false,
  ...props
}: Omit<SheetPrimitive.Title.Props, "className" | "style"> & {
  size?: "xl" | "base" | "sm";
  row?: boolean;
}): React.ReactElement {
  return (
    <SheetPrimitive.Title
      className={stylex.props(styles.title, size === "base" && styles.titleBase, size === "sm" && styles.titleSm, row && styles.titleRow).className}
      data-slot="sheet-title"
      {...props}
    />
  );
}

export function SheetDescription({
  stack = false,
  ...props
}: Omit<SheetPrimitive.Description.Props, "className" | "style"> & {
  stack?: boolean;
}): React.ReactElement {
  return (
    <SheetPrimitive.Description
      className={stylex.props(styles.description, stack && styles.descriptionStack).className}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export function SheetPanel({
  scrollFade = true,
  stack,
  container = false,
  padTop = false,
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className" | "style"> & {
  scrollFade?: boolean;
  stack?: 4 | 5;
  container?: boolean;
  padTop?: boolean;
}): React.ReactElement {
  const defaultProps = {
    className: stylex.props(
      styles.panel,
      stack != null && styles.stack,
      stack === 4 && styles.gap4,
      stack === 5 && styles.gap5,
      container && styles.container,
      padTop && styles.padTop,
    ).className,
    "data-slot": "sheet-panel",
  };
  return (
    <ScrollArea overscrollContain scrollFade={scrollFade}>
      {useRender({ defaultTagName: "div", props: mergeProps<"div">(defaultProps, props), render })}
    </ScrollArea>
  );
}

export { SheetPrimitive, SheetBackdrop as SheetOverlay, SheetPopup as SheetContent };
