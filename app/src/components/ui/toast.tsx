"use client";

import { Toast } from "@base-ui/react/toast";
import * as stylex from "@stylexjs/stylex";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import type React from "react";

import { buttonClass } from "@/components/ui/button";
import { type Box, useModalBox } from "@/hooks/use-modal-open";
import { color, radius } from "@/styles/tokens.stylex";


const sm = "@media (min-width: 640px)";
const still = "@media (prefers-reduced-motion: reduce)";

const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});
const successA = stylex.keyframes({
  "0%": { scale: 1 },
  "30%": { scale: 1.025 },
  "60%": { scale: 0.99 },
  "100%": { scale: 1 },
});
const successB = stylex.keyframes({
  "0%": { scale: 1 },
  "30%": { scale: 1.025 },
  "60%": { scale: 0.99 },
  "100%": { scale: 1 },
});
const errorA = stylex.keyframes({
  "0%": { translate: "0 0" },
  "25%": { translate: "-3px 0" },
  "50%": { translate: "3px 0" },
  "75%": { translate: "-3px 0" },
  "100%": { translate: "0 0" },
});
const errorB = stylex.keyframes({
  "0%": { translate: "0 0" },
  "25%": { translate: "-3px 0" },
  "50%": { translate: "3px 0" },
  "75%": { translate: "-3px 0" },
  "100%": { translate: "0 0" },
});

const styles = stylex.create({
  viewport: {
    position: "fixed",
    zIndex: 60,
    marginLeft: "auto",
    marginRight: "auto",
    display: "flex",
    width: "calc(100% - var(--toast-inset) * 2)",
    maxWidth: "22.5rem",
    "--toast-inset": { default: "16px", [sm]: "32px" },
  },
  cap: { maxWidth: "22rem" },
  edgeTop: { top: "var(--toast-inset)" },
  edgeBottom: { bottom: "var(--toast-inset)" },
  edgeLeft: { left: "var(--toast-inset)" },
  edgeRight: { right: "var(--toast-inset)" },
  edgeCenter: { left: "50%", transform: "translateX(-50%)" },
  chromeBottomRight: {
    right: 12,
    bottom: "max(calc(var(--berth-status-h, 26px) + 12px + max(var(--berth-loops-h, 0px), var(--berth-home-composer-h, 0px))), var(--berth-bar-lift, 0px))",
  },
  chromeBottomLeft: { left: 12, bottom: "calc(var(--berth-status-h, 26px) + 12px)" },
  chromeTopLeft: { top: 12, left: 12 },
  chromeTopRight: { top: 12, right: 12 },
  onboardingCorner: { right: 12, bottom: 12 },
  root: {
    position: "absolute",
    zIndex: "calc(9999 - var(--toast-index))",
    height: "var(--toast-calc-height)",
    width: "100%",
    userSelect: "none",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: "var(--toast-stack)",
    backgroundClip: "padding-box",
    color: color.popoverForeground,
    boxShadow: "none",
    transitionProperty: "transform, opacity, height, background-color",
    transitionDuration: { default: "0.5s, 0.5s, 0.15s, 0.5s", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(.22, 1, .36, 1)",
    "--toast-calc-height": "var(--toast-frontmost-height, var(--toast-height))",
    "--toast-gap": "12px",
    "--toast-peek": "12px",
    "--toast-scale": "calc(max(0, 1 - (var(--toast-index) * 0.1)))",
    "--toast-shrink": "calc(1 - var(--toast-scale))",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-lg) - 1px)",
      boxShadow: "none",
    },
    "::after": {
      content: '""',
      position: "absolute",
      left: 0,
      height: "calc(var(--toast-gap) + 1px)",
      width: "100%",
    },
  },
  stackTop: {
    top: 0,
    bottom: "auto",
    left: 0,
    transformOrigin: "50% calc(50% - 50% * min(var(--toast-index, 0), 1))",
    "--toast-calc-offset-y": "calc(var(--toast-offset-y) + var(--toast-index) * var(--toast-gap) + var(--toast-swipe-movement-y))",
    transform: "translateX(var(--toast-swipe-movement-x)) translateY(calc(var(--toast-swipe-movement-y) + (var(--toast-index) * var(--toast-peek)) + (var(--toast-shrink) * var(--toast-calc-height)))) scale(var(--toast-scale))",
    "::after": { top: "100%" },
  },
  stackBottom: {
    top: "auto",
    bottom: 0,
    transformOrigin: "50% calc(50% + 50% * min(var(--toast-index, 0), 1))",
    "--toast-calc-offset-y": "calc(var(--toast-offset-y) * -1 + var(--toast-index) * var(--toast-gap) * -1 + var(--toast-swipe-movement-y))",
    transform: "translateX(var(--toast-swipe-movement-x)) translateY(calc(var(--toast-swipe-movement-y) - (var(--toast-index) * var(--toast-peek)) - (var(--toast-shrink) * var(--toast-calc-height)))) scale(var(--toast-scale))",
    "::after": { bottom: "100%" },
  },
  pinRight: { right: 0, left: "auto" },
  pinLeft: { right: "auto", left: 0 },
  pinCenter: { right: 0, left: 0 },
  expanded: {
    height: "var(--toast-height)",
    backgroundColor: color.popover,
    transform: "translateX(var(--toast-swipe-movement-x)) translateY(var(--toast-calc-offset-y))",
  },
  limited: { opacity: 0 },
  enterTop: { transform: "translateY(calc(-100% - var(--toast-inset)))" },
  enterBottom: { transform: "translateY(calc(100% + var(--toast-inset)))" },
  ending: { opacity: 0 },
  leaveTop: { transform: "translateY(calc(-100% - var(--toast-inset)))" },
  leaveBottom: { transform: "translateY(calc(100% + var(--toast-inset)))" },
  leaveLeft: { transform: "translateX(calc(var(--toast-swipe-movement-x) - 100% - var(--toast-inset))) translateY(var(--toast-calc-offset-y))" },
  leaveRight: { transform: "translateX(calc(var(--toast-swipe-movement-x) + 100% + var(--toast-inset))) translateY(var(--toast-calc-offset-y))" },
  leaveUp: { transform: "translateY(calc(var(--toast-swipe-movement-y) - 100% - var(--toast-inset)))" },
  leaveDown: { transform: "translateY(calc(var(--toast-swipe-movement-y) + 100% + var(--toast-inset)))" },
  replaySuccess: { animationName: successA, animationDuration: { default: "0.32s", [still]: "0s" }, animationTimingFunction: "cubic-bezier(0.5, 1, 0.89, 1)" },
  replaySuccessAlt: { animationName: successB, animationDuration: { default: "0.32s", [still]: "0s" }, animationTimingFunction: "cubic-bezier(0.5, 1, 0.89, 1)" },
  replayError: { animationName: errorA, animationDuration: { default: "0.28s", [still]: "0s" }, animationTimingFunction: "cubic-bezier(0.5, 1, 0.89, 1)" },
  replayErrorAlt: { animationName: errorB, animationDuration: { default: "0.28s", [still]: "0s" }, animationTimingFunction: "cubic-bezier(0.5, 1, 0.89, 1)" },
  content: {
    pointerEvents: "auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
    overflow: "hidden",
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 14,
    paddingRight: 14,
    fontSize: 14,
    transitionProperty: "opacity",
    transitionDuration: { default: "250ms", [still]: "0s" },
  },
  behind: { pointerEvents: "none", opacity: 0 },
  shown: { opacity: 1 },
  row: { display: "flex", minWidth: 0, flexGrow: 1, gap: 8 },
  copy: { display: "flex", minWidth: 0, flexDirection: "column", gap: 2 },
  icon: { pointerEvents: "none", flexShrink: 0 },
  glyph: { width: 16, height: "1lh" },
  iconError: { color: color.destructive },
  iconInfo: { color: color.info },
  iconSuccess: { color: color.success },
  iconWarning: { color: color.warning },
  iconLoading: { opacity: 0.8, animationName: spin, animationDuration: { default: "1s", [still]: "0s" }, animationTimingFunction: "linear", animationIterationCount: "infinite" },
  title: { fontWeight: 500, overflowWrap: "anywhere" },
  description: { color: color.mutedForeground, overflowWrap: "anywhere" },
  action: { marginTop: 6, width: "fit-content", maxWidth: "100%" },
  close: {
    display: "inline-flex",
    width: 24,
    height: 24,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -2,
    marginRight: -6,
    borderRadius: radius.md,
    borderWidth: 0,
    backgroundColor: { default: "transparent", ":hover": color.accent },
    color: { default: "color-mix(in oklab, var(--muted-foreground) 70%, transparent)", ":hover": color.foreground },
    cursor: "pointer",
  },
  closeIcon: { width: 14, height: 14 },
  anchoredViewport: { outline: "none" },
  positioner: { zIndex: 60, maxWidth: "min(16rem, var(--available-width))" },
  anchored: {
    position: "relative",
    textWrap: "balance",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    color: color.popoverForeground,
    fontSize: 12,
    transitionProperty: "scale, opacity",
    transitionDuration: { default: "200ms", [still]: "0s" },
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      boxShadow: "none",
    },
  },
  anchoredTip: {
    borderRadius: radius.md,
    boxShadow: "none",
    "::before": { borderRadius: "calc(var(--radius-md) - 1px)" },
  },
  anchoredCard: {
    borderRadius: radius.lg,
    boxShadow: "none",
    "::before": { borderRadius: "calc(var(--radius-lg) - 1px)" },
  },
  anchoredMotion: { opacity: 0, scale: 0.98 },
  tipContent: { pointerEvents: "auto", paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 },
  cardContent: {
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    overflow: "hidden",
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 14,
    paddingRight: 14,
    fontSize: 14,
  },
  cardRow: { display: "flex", gap: 8 },
  cardCopy: { display: "flex", flexDirection: "column", gap: 2 },
  cardDescription: { color: color.mutedForeground },
});

const TOAST_ICONS = {
  error: CircleAlertIcon,
  info: InfoIcon,
  loading: LoaderCircleIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
} as const;

type SwipeDirection = "up" | "down" | "left" | "right";

type ToastData = {
  rootProps?: Omit<React.ComponentProps<typeof Toast.Root>, "children" | "className" | "swipeDirection" | "toast">;
  tooltipStyle?: boolean;
};

const iconTone = {
  error: styles.iconError,
  info: styles.iconInfo,
  loading: styles.iconLoading,
  success: styles.iconSuccess,
  warning: styles.iconWarning,
} as const;

function getSwipeDirection(position: ToastPosition): SwipeDirection[] {
  const verticalDirection: SwipeDirection = position.startsWith("top") ? "up" : "down";
  if (position.includes("center")) return [verticalDirection];
  if (position.includes("left")) return ["left", verticalDirection];
  return ["right", verticalDirection];
}

function replayStyle(toast: { type?: string; updateKey?: number }) {
  const k = toast.updateKey ?? 0;
  if (k <= 0) return false;
  const even = k % 2 === 0;
  if (toast.type === "error") return even ? styles.replayErrorAlt : styles.replayError;
  return even ? styles.replaySuccessAlt : styles.replaySuccess;
}

const STACK_W = 352;
const STACK_H = 100;
const area = (a: Box, b: Box) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function clearOf(m: Box): ToastPosition {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const spots: [ToastPosition, Box][] = [
    ["bottom-left", { left: 12, right: 12 + STACK_W, top: H - 38 - STACK_H, bottom: H - 38 }],
    ["bottom-right", { left: W - 12 - STACK_W, right: W - 12, top: H - 38 - STACK_H, bottom: H - 38 }],
    ["top-right", { left: W - 12 - STACK_W, right: W - 12, top: 12, bottom: 12 + STACK_H }],
    ["top-left", { left: 12, right: 12 + STACK_W, top: 12, bottom: 12 + STACK_H }],
  ];
  let best = spots[0][0];
  let least = Number.POSITIVE_INFINITY;
  for (const [at, spot] of spots) {
    const covered = area(spot, m);
    if (covered === 0) return at;
    if (covered < least) {
      least = covered;
      best = at;
    }
  }
  return best;
}

function viewportClass(position: ToastPosition, clear: ToastClear): string | undefined {
  const top = position.startsWith("top");
  const left = position.includes("left");
  const right = position.includes("right");
  const center = position.includes("center");
  return stylex.props(
    styles.viewport,
    top ? styles.edgeTop : styles.edgeBottom,
    left ? styles.edgeLeft : right ? styles.edgeRight : center ? styles.edgeCenter : null,
    clear !== "none" && styles.cap,
    clear === "onboarding" && position === "bottom-right" && styles.onboardingCorner,
    clear === "chrome" && position === "bottom-right" && styles.chromeBottomRight,
    clear === "chrome" && position === "bottom-left" && styles.chromeBottomLeft,
    clear === "chrome" && position === "top-left" && styles.chromeTopLeft,
    clear === "chrome" && position === "top-right" && styles.chromeTopRight,
  ).className;
}

function rootClass(
  position: ToastPosition,
  state: { expanded: boolean; limited: boolean; transitionStatus?: string; swipeDirection?: SwipeDirection },
  replay: ReturnType<typeof replayStyle>,
): string | undefined {
  const top = position.startsWith("top");
  const left = position.includes("left");
  const right = position.includes("right");
  const starting = state.transitionStatus === "starting";
  const ending = state.transitionStatus === "ending";
  const swipe = state.swipeDirection;
  return stylex.props(
    styles.root,
    top ? styles.stackTop : styles.stackBottom,
    right ? styles.pinRight : left ? styles.pinLeft : styles.pinCenter,
    state.expanded && styles.expanded,
    state.limited && styles.limited,
    starting && (top ? styles.enterTop : styles.enterBottom),
    ending && styles.ending,
    ending && !state.limited && swipe == null && (top ? styles.leaveTop : styles.leaveBottom),
    ending && swipe === "left" && styles.leaveLeft,
    ending && swipe === "right" && styles.leaveRight,
    ending && swipe === "up" && styles.leaveUp,
    ending && swipe === "down" && styles.leaveDown,
    replay,
  ).className;
}

function ToastIcon({ type }: { type: string | undefined }) {
  if (!type || !(type in TOAST_ICONS)) return null;
  const Icon = TOAST_ICONS[type as keyof typeof TOAST_ICONS];
  return (
    <div {...stylex.props(styles.icon)} data-slot="toast-icon">
      <Icon className={stylex.props(styles.glyph, iconTone[type as keyof typeof iconTone]).className} />
    </div>
  );
}

function Toasts({
  position,
  portalProps,
  clear,
}: {
  clear: ToastClear;
  position: ToastPosition;
  portalProps?: React.ComponentProps<typeof Toast.Portal>;
}): React.ReactElement {
  const { toasts } = Toast.useToastManager();
  // Toasts stay above everything, so feedback on a dialog's action shows,
  // but while a dialog or sheet is open they move to a corner clear of it.
  const modal = useModalBox();
  if (modal) position = clearOf(modal);
  const swipeDirection = getSwipeDirection(position);

  return (
    <Toast.Portal data-slot="toast-portal" {...portalProps}>
      <Toast.Viewport className={viewportClass(position, clear)} data-position={position} data-slot="toast-viewport" aria-label="Alerts">
        {toasts.map((toast) => {
          const toastData = toast.data as ToastData | undefined;
          return (
            <Toast.Root
              key={toast.id}
              className={(state) => rootClass(position, state, replayStyle(toast))}
              {...toastData?.rootProps}
              data-position={position}
              swipeDirection={swipeDirection}
              toast={toast}
            >
              <Toast.Content
                className={(state) => stylex.props(styles.content, state.behind && !state.expanded && styles.behind, state.expanded && styles.shown).className}
                data-slot="toast-content"
              >
                <div {...stylex.props(styles.row)}>
                  <ToastIcon type={toast.type} />
                  <div {...stylex.props(styles.copy)}>
                    <Toast.Title className={stylex.props(styles.title).className} data-slot="toast-title" />
                    <Toast.Description className={stylex.props(styles.description).className} data-slot="toast-description" render={<div />} />
                    {toast.actionProps && (
                      <div {...stylex.props(styles.action)}>
                        <Toast.Action className={buttonClass("outline", "xs")} data-slot="toast-action">
                          {toast.actionProps.children}
                        </Toast.Action>
                      </div>
                    )}
                  </div>
                </div>
                {toast.type !== "loading" && (
                  <Toast.Close aria-label="Dismiss" className={stylex.props(styles.close).className} data-slot="toast-close">
                    <XIcon className={stylex.props(styles.closeIcon).className} />
                  </Toast.Close>
                )}
              </Toast.Content>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function AnchoredToasts({ portalProps }: { portalProps?: React.ComponentProps<typeof Toast.Portal> }): React.ReactElement {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal data-slot="toast-portal-anchored" {...portalProps}>
      <Toast.Viewport className={stylex.props(styles.anchoredViewport).className} data-slot="toast-viewport-anchored">
        {toasts.map((toast) => {
          const toastData = toast.data as ToastData | undefined;
          const tooltipStyle = toastData?.tooltipStyle ?? false;
          const positionerProps = toast.positionerProps;
          if (!positionerProps?.anchor) return null;
          return (
            <Toast.Positioner
              key={toast.id}
              className={stylex.props(styles.positioner).className}
              data-slot="toast-positioner"
              sideOffset={positionerProps.sideOffset ?? 4}
              toast={toast}
            >
              <Toast.Root
                className={(state) =>
                  stylex.props(
                    styles.anchored,
                    tooltipStyle ? styles.anchoredTip : styles.anchoredCard,
                    (state.transitionStatus === "starting" || state.transitionStatus === "ending") && styles.anchoredMotion,
                    replayStyle(toast),
                  ).className
                }
                {...toastData?.rootProps}
                data-slot="toast-popup"
                toast={toast}
              >
                {tooltipStyle ? (
                  <Toast.Content className={stylex.props(styles.tipContent).className}>
                    <Toast.Title data-slot="toast-title" />
                  </Toast.Content>
                ) : (
                  <Toast.Content className={stylex.props(styles.cardContent).className}>
                    <div {...stylex.props(styles.cardRow)}>
                      <ToastIcon type={toast.type} />
                      <div {...stylex.props(styles.cardCopy)}>
                        <Toast.Title className={stylex.props(styles.title).className} data-slot="toast-title" />
                        <Toast.Description className={stylex.props(styles.cardDescription).className} data-slot="toast-description" />
                      </div>
                    </div>
                    {toast.actionProps && (
                      <Toast.Action className={buttonClass("default", "xs")} data-slot="toast-action">
                        {toast.actionProps.children}
                      </Toast.Action>
                    )}
                  </Toast.Content>
                )}
              </Toast.Root>
            </Toast.Positioner>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export const toastManager: ReturnType<typeof Toast.createToastManager> = Toast.createToastManager();
export const anchoredToastManager: ReturnType<typeof Toast.createToastManager> = Toast.createToastManager();

export type ToastPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export type ToastClear = "none" | "onboarding" | "chrome";

export interface ToastProviderProps extends Toast.Provider.Props {
  position?: ToastPosition;
  portalProps?: React.ComponentProps<typeof Toast.Portal>;
  /** Where the stack sits so it clears this window's chrome. */
  clear?: ToastClear;
}

export function ToastProvider({ children, position = "bottom-right", portalProps, clear = "none", ...props }: ToastProviderProps): React.ReactElement {
  return (
    <Toast.Provider toastManager={toastManager} {...props}>
      {children}
      <Toasts portalProps={portalProps} position={position} clear={clear} />
    </Toast.Provider>
  );
}

export interface AnchoredToastProviderProps extends Toast.Provider.Props {
  portalProps?: React.ComponentProps<typeof Toast.Portal>;
}

export function AnchoredToastProvider({ children, portalProps, ...props }: AnchoredToastProviderProps): React.ReactElement {
  return (
    <Toast.Provider toastManager={anchoredToastManager} {...props}>
      {children}
      <AnchoredToasts portalProps={portalProps} />
    </Toast.Provider>
  );
}

export { Toast as ToastPrimitive };
