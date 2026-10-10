import * as stylex from "@stylexjs/stylex";

import { color, font, radius } from "@/styles/tokens.stylex";
import { overlay } from "@/components/ui/overlay-tokens.stylex";


const sm = "@media (min-width: 640px)";
const narrow = "@media (max-width: 639px)";
const still = "@media (prefers-reduced-motion: reduce)";

const underHeader = ":is([data-slot='dialog-popup']:has([data-slot='dialog-header']) > &, [data-slot='alert-dialog-popup']:has([data-slot='alert-dialog-header']) > &)";
const overPanel = ":is([data-slot='dialog-popup']:has([data-slot='dialog-panel']) > &, [data-slot='alert-dialog-popup']:has([data-slot='alert-dialog-panel']) > &)";
const overBareFooter = ":is([data-slot='dialog-popup']:has([data-slot='dialog-footer'][data-variant='bare']) > &)";

export const dialogStyles = stylex.create({
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    backgroundColor: "color-mix(in oklab, black 32%, transparent)",
    transitionProperty: "opacity",
    transitionDuration: { default: "200ms", [still]: "0s" },
  },
  gone: { opacity: 0 },
  viewport: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    display: "grid",
    gridTemplateRows: "minmax(0, 1fr)",
    alignItems: "center",
    justifyItems: "center",
    padding: 24,
  },
  anchoredViewport: { alignItems: "start", paddingTop: "12dvh" },
  bottomViewport: {
    alignItems: { default: "center", [narrow]: "end" },
    paddingTop: { default: 24, [narrow]: 48 },
    paddingRight: { default: 24, [narrow]: 0 },
    paddingBottom: { default: 24, [narrow]: 0 },
    paddingLeft: { default: 24, [narrow]: 0 },
  },
  anchoredBottomViewport: {
    alignItems: { default: "start", [narrow]: "end" },
    paddingTop: { default: "12dvh", [narrow]: 48 },
  },
  popup: {
    position: "relative",
    gridRowStart: 1,
    display: "flex",
    flexDirection: "column",
    maxHeight: "min(80dvh, calc(100dvh - 48px))",
    overflowX: "hidden",
    overflowY: "auto",
    minHeight: 0,
    width: "100%",
    minWidth: 0,
    maxWidth: "var(--dialog-width, 32rem)",
    transformOrigin: "var(--dialog-transform-origin, center)",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    color: color.popoverForeground,
    opacity: "calc(1 - var(--nested-dialogs, 0))",
    boxShadow: overlay.shadow,
    outline: "none",
    scale: { default: "calc(1 - 0.1 * var(--nested-dialogs, 0))", [narrow]: 1 },
    transitionProperty: "scale, opacity, translate",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "ease-in-out",
    willChange: "transform",
  },
  fade: {
    opacity: 0,
    scale: { default: 0.98, [narrow]: 1 },
  },
  bottom: {
    maxWidth: { default: "var(--dialog-width, 32rem)", [narrow]: "none" },
    transformOrigin: { default: "var(--dialog-transform-origin, center)", [narrow]: "bottom" },
    borderRadius: { default: radius.xl, [narrow]: 0 },
    borderLeftWidth: { default: 1, [narrow]: 0 },
    borderRightWidth: { default: 1, [narrow]: 0 },
    borderBottomWidth: { default: 1, [narrow]: 0 },
  },
  bottomFade: {
    translate: { default: "0 0", [narrow]: "0 16px" },
  },
  anchoredPopup: {
    maxHeight: "min(80dvh, calc(88dvh - 24px))",
    "--dialog-transform-origin": "top",
  },
  widthMd: { "--dialog-width": "28rem" },
  widthLg: { "--dialog-width": "32rem" },
  width34: { "--dialog-width": "34rem" },
  widthXl: { "--dialog-width": "36rem" },
  width38: { "--dialog-width": "38rem" },
  width40: { "--dialog-width": "40rem" },
  width2xl: { "--dialog-width": "42rem" },
  width3xl: { "--dialog-width": "48rem" },
  width4xl: { "--dialog-width": "56rem" },
  composer: { maxHeight: "min(calc(88vh - 2rem), 60rem)" },
  picker: {
    height: "min(620px, 88vh)",
    "--dialog-width": "min(940px, calc(100vw - 2rem))",
    overflow: "hidden",
    padding: 0,
  },
  preview: { padding: 8 },
  notes: { "--dialog-width": "880px", overflow: "hidden" },
  close: {
    position: "absolute",
    top: 8,
    insetInlineEnd: 8,
  },
  mediaClose: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: radius.full,
    padding: 4,
    backgroundColor: {
      default: "color-mix(in oklab, var(--foreground) 60%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    },
    color: color.background,
    cursor: "pointer",
    outline: "none",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: 8,
    padding: 24,
    paddingBottom: {
      default: 24,
      [narrow]: 16,
      [overPanel]: 12,
    },
  },
  headerStep: {
    gap: 6,
    paddingTop: 20,
    paddingRight: 20,
    paddingBottom: 12,
    paddingLeft: 20,
  },
  headerNotes: {
    gap: 4,
    paddingTop: 20,
    paddingRight: 20,
    paddingBottom: 16,
    paddingLeft: 20,
  },
  headerShort: { paddingBottom: 12 },
  alertHeader: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: 8,
    padding: 24,
    paddingBottom: { default: 24, [narrow]: 16 },
    textAlign: { default: "center", [sm]: "left" },
  },
  footer: {
    display: "flex",
    flexShrink: 0,
    flexDirection: { default: "column-reverse", [sm]: "row" },
    gap: 8,
    paddingLeft: 24,
    paddingRight: 24,
    justifyContent: { default: "flex-start", [sm]: "flex-end" },
    borderBottomLeftRadius: { default: 0, [sm]: "calc(var(--radius-2xl) - 1px)" },
    borderBottomRightRadius: { default: 0, [sm]: "calc(var(--radius-2xl) - 1px)" },
  },
  band: {
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    backgroundColor: "color-mix(in oklab, var(--muted) 72%, transparent)",
    paddingTop: 16,
    paddingBottom: 16,
  },
  bare: {
    paddingTop: { default: 16, [overPanel]: 12 },
    paddingBottom: 24,
  },
  alertBare: { paddingBottom: 24 },
  actions: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 20,
  },
  split: { justifyContent: { default: "flex-start", [sm]: "space-between" } },
  split10: { paddingTop: 10, paddingBottom: 10 },
  tall: {
    height: 56,
    alignItems: "center",
    gap: 12,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 20,
    paddingRight: 20,
    justifyContent: { default: "flex-start", [sm]: "space-between" },
  },
  bar: {
    height: 56,
    alignItems: "center",
    gap: 8,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 20,
    paddingRight: 20,
  },
  edge: { paddingLeft: 20, paddingRight: 20 },
  notesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: "auto",
    marginLeft: { default: 20, [sm]: 32 },
    marginRight: { default: 20, [sm]: 32 },
    paddingTop: 16,
    paddingBottom: 24,
    paddingLeft: 0,
    paddingRight: 0,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
  },
  title: {
    fontFamily: "var(--font-heading)",
    fontWeight: 600,
    fontSize: 20,
    lineHeight: 1,
  },
  titleBase: { fontSize: 16 },
  titleTight: { fontSize: 16, lineHeight: 1.25 },
  titleLine: { fontSize: 16, lineHeight: "24px" },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  truncate: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  shrink: { flexShrink: 0 },
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
  description: {
    color: color.mutedForeground,
    fontSize: 14,
  },
  descriptionXs: { fontSize: 12 },
  description13: { fontSize: 13 },
  mono: { fontFamily: font.mono },
  nudge: { marginTop: 2 },
  panel: {
    paddingTop: { default: 24, [underHeader]: 4 },
    paddingRight: 24,
    paddingBottom: { default: 24, [overBareFooter]: 4 },
    paddingLeft: 24,
  },
  insetBody: { paddingRight: 20, paddingBottom: 20, paddingLeft: 20 },
  insetTight: { paddingRight: 20, paddingBottom: 16, paddingLeft: 20 },
  insetSection: { paddingTop: 4, paddingRight: 20, paddingBottom: 16, paddingLeft: 20 },
  stack: { display: "flex", flexDirection: "column" },
  gap2: { gap: 8 },
  gap3: { gap: 12 },
  gap4: { gap: 16 },
  drop: {
    outlineWidth: 2,
    outlineStyle: "dashed",
    outlineColor: "color-mix(in oklab, var(--ring) 60%, transparent)",
    outlineOffset: -4,
  },
});

export type DialogWidth = "md" | "lg" | "34" | "xl" | "38" | "40" | "2xl" | "3xl" | "4xl";
export type DialogFrame = "default" | "composer" | "picker" | "preview" | "notes";
export type DialogHeaderPad = "default" | "step" | "notes" | "short";
export type DialogFooterPad = "actions" | "split" | "split10" | "tall" | "bar" | "edge" | "notes";
export type DialogInset = "default" | "body" | "tight" | "section";
export type DialogStack = 2 | 3 | 4;
export type DialogTitleSize = "xl" | "base" | "tight" | "line";
export type DialogDescriptionSize = "sm" | "xs" | "13";

const widthStyle = {
  md: dialogStyles.widthMd,
  lg: dialogStyles.widthLg,
  "34": dialogStyles.width34,
  xl: dialogStyles.widthXl,
  "38": dialogStyles.width38,
  "40": dialogStyles.width40,
  "2xl": dialogStyles.width2xl,
  "3xl": dialogStyles.width3xl,
  "4xl": dialogStyles.width4xl,
} as const;

const headerPad = {
  default: null,
  step: dialogStyles.headerStep,
  notes: dialogStyles.headerNotes,
  short: dialogStyles.headerShort,
} as const;

const insetStyle = {
  default: null,
  body: dialogStyles.insetBody,
  tight: dialogStyles.insetTight,
  section: dialogStyles.insetSection,
} as const;

const stackGap = {
  2: dialogStyles.gap2,
  3: dialogStyles.gap3,
  4: dialogStyles.gap4,
} as const;

const titleSize = {
  xl: null,
  base: dialogStyles.titleBase,
  tight: dialogStyles.titleTight,
  line: dialogStyles.titleLine,
} as const;

const descriptionSize = {
  sm: null,
  xs: dialogStyles.descriptionXs,
  "13": dialogStyles.description13,
} as const;

export function backdropClass(starting: boolean): string | undefined {
  return stylex.props(dialogStyles.backdrop, starting && dialogStyles.gone).className;
}

export function viewportClass(anchored: boolean, bottom: boolean): string | undefined {
  return stylex.props(
    dialogStyles.viewport,
    anchored && dialogStyles.anchoredViewport,
    bottom && dialogStyles.bottomViewport,
    anchored && bottom && dialogStyles.anchoredBottomViewport,
  ).className;
}

export function popupClass(opts: {
  width: DialogWidth;
  frame: DialogFrame;
  anchored: boolean;
  bottom: boolean;
  starting: boolean;
}): string | undefined {
  const sized = opts.frame !== "picker" && opts.frame !== "notes";
  return stylex.props(
    dialogStyles.popup,
    sized && widthStyle[opts.width],
    opts.anchored && dialogStyles.anchoredPopup,
    opts.frame === "composer" && dialogStyles.composer,
    opts.frame === "picker" && dialogStyles.picker,
    opts.frame === "preview" && dialogStyles.preview,
    opts.frame === "notes" && dialogStyles.notes,
    opts.bottom && dialogStyles.bottom,
    opts.starting && dialogStyles.fade,
    opts.starting && opts.bottom && dialogStyles.bottomFade,
  ).className;
}

export function headerClass(pad: DialogHeaderPad): string | undefined {
  return stylex.props(dialogStyles.header, headerPad[pad]).className;
}

export function alertHeaderClass(): string | undefined {
  return stylex.props(dialogStyles.alertHeader).className;
}

export function footerClass(variant: "default" | "bare", pad?: DialogFooterPad): string | undefined {
  return stylex.props(
    dialogStyles.footer,
    variant === "default" && dialogStyles.band,
    variant === "bare" && dialogStyles.bare,
    pad === "actions" && dialogStyles.actions,
    (pad === "split" || pad === "split10") && dialogStyles.actions,
    (pad === "split" || pad === "split10") && dialogStyles.split,
    pad === "split10" && dialogStyles.split10,
    pad === "tall" && dialogStyles.tall,
    pad === "bar" && dialogStyles.bar,
    pad === "edge" && dialogStyles.edge,
    pad === "notes" && dialogStyles.notesFooter,
  ).className;
}

export function alertFooterClass(variant: "default" | "bare"): string | undefined {
  return stylex.props(dialogStyles.footer, variant === "default" && dialogStyles.band, variant === "bare" && dialogStyles.alertBare).className;
}

export function titleClass(opts: {
  size: DialogTitleSize;
  row: boolean;
  truncate: boolean;
  shrink: boolean;
  hidden: boolean;
}): string | undefined {
  return stylex.props(
    dialogStyles.title,
    titleSize[opts.size],
    opts.row && dialogStyles.titleRow,
    opts.truncate && dialogStyles.truncate,
    opts.shrink && dialogStyles.shrink,
    opts.hidden && dialogStyles.srOnly,
  ).className;
}

export function descriptionClass(opts: {
  size: DialogDescriptionSize;
  mono: boolean;
  hidden: boolean;
  nudge: boolean;
}): string | undefined {
  return stylex.props(
    dialogStyles.description,
    descriptionSize[opts.size],
    opts.mono && dialogStyles.mono,
    opts.hidden && dialogStyles.srOnly,
    opts.nudge && dialogStyles.nudge,
  ).className;
}

export function panelClass(inset: DialogInset, stack?: DialogStack, drop = false): string | undefined {
  return stylex.props(
    dialogStyles.panel,
    insetStyle[inset],
    stack != null && dialogStyles.stack,
    stack != null && stackGap[stack],
    drop && dialogStyles.drop,
  ).className;
}

export function closeClass(): string | undefined {
  return stylex.props(dialogStyles.close).className;
}

export function mediaCloseClass(): string | undefined {
  return stylex.props(dialogStyles.mediaClose).className;
}
