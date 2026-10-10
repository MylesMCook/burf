import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

import { color, font, radius } from "@/styles/tokens.stylex";
import { overlay } from "@/components/ui/overlay-tokens.stylex";


const sm = "@media (min-width: 640px)";
const still = "@media (prefers-reduced-motion: reduce)";

// One menu. Popup, row, check, and label are the same everywhere.
const styles = stylex.create({
  positioner: {
    zIndex: 50,
  },
  rowTrigger: {
    display: "block",
    borderRadius: radius.md,
    backgroundColor: "transparent",
  },
  rowTriggerOpen: {
    backgroundColor: color.sidebarAccent,
  },
  popup: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minWidth: "15rem",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    color: color.popoverForeground,
    boxShadow: overlay.shadow,
    outline: "none",
    transformOrigin: "var(--transform-origin)",
    fontFamily: font.sans,
  },
  scroll: {
    maxHeight: "var(--available-height)",
    width: "100%",
    overflowY: "auto",
    padding: 4,
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: { default: 32, [sm]: 28 },
    borderRadius: radius.sm,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: { default: 16, [sm]: 14 },
    lineHeight: "20px",
    color: color.foreground,
    cursor: "default",
    userSelect: "none",
    outline: "none",
    backgroundColor: "transparent",
  },
  highlighted: {
    backgroundColor: color.accent,
    color: color.accentForeground,
  },
  disabled: {
    pointerEvents: "none",
    opacity: 0.64,
  },
  inset: {
    paddingLeft: 32,
  },
  destructive: {
    color: color.destructiveForeground,
  },
  current: {
    backgroundColor: color.accent,
    fontWeight: 500,
  },
  radio: {
    display: "grid",
    gridTemplateColumns: "0.75rem minmax(0, 1fr)",
    alignItems: "center",
    columnGap: 8,
    minHeight: { default: 32, [sm]: 28 },
    borderRadius: radius.sm,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 16,
    fontSize: { default: 16, [sm]: 14 },
    lineHeight: "20px",
    color: color.foreground,
    cursor: "default",
    userSelect: "none",
    outline: "none",
    backgroundColor: "transparent",
  },
  check: {
    display: "flex",
    width: 12,
    height: 12,
  },
  indicator: {
    gridColumnStart: 1,
    gridRowStart: 1,
  },
  itemText: {
    gridColumnStart: 2,
    gridRowStart: 1,
    minWidth: 0,
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "16px",
    color: color.mutedForeground,
  },
  separator: {
    height: 1,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 8,
    marginRight: 8,
    backgroundColor: color.border,
  },
  shortcut: {
    marginLeft: "auto",
    fontFamily: font.sans,
    fontSize: 12,
    fontWeight: 500,
    color: color.mutedForeground,
  },
  chevron: {
    marginLeft: "auto",
    width: 16,
    height: 16,
    flexShrink: 0,
    opacity: 0.8,
  },
  spread: {
    justifyContent: "space-between",
    width: "100%",
  },
  switchTrack: {
    display: "inline-flex",
    alignItems: "center",
    width: 28,
    height: 16,
    flexShrink: 0,
    borderRadius: radius.full,
    padding: 1,
    backgroundColor: color.input,
  },
  switchOn: {
    backgroundColor: color.primary,
  },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: color.background,
    transform: "translateX(0)",
    transitionProperty: "transform",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  switchThumbOn: {
    transform: "translateX(12px)",
  },
  w40: { minWidth: "10rem" },
  w44: { minWidth: "11rem" },
  w48: { minWidth: "12rem" },
  w52: { minWidth: "13rem" },
  w56: { minWidth: "14rem" },
  w64: { minWidth: "16rem" },
  w72: { minWidth: "18rem" },
  w80: { minWidth: "20rem" },
  anchor: { minWidth: "var(--anchor-width)" },
  fixed72: { width: "18rem" },
  fixed80: { width: "20rem" },
});

export const menuWidths = {
  w40: styles.w40,
  w44: styles.w44,
  w48: styles.w48,
  w52: styles.w52,
  w56: styles.w56,
  w64: styles.w64,
  w72: styles.w72,
  w80: styles.w80,
  anchor: styles.anchor,
  fixed72: styles.fixed72,
  fixed80: styles.fixed80,
};

export type MenuWidth = StyleXStyles<{
  minWidth?: string;
  width?: string;
  maxWidth?: string;
}>;

type ItemState = { highlighted: boolean; disabled?: boolean };

export function positionerClass(): string | undefined {
  return stylex.props(styles.positioner).className;
}

export function rowTriggerClass(open: boolean): string | undefined {
  return stylex.props(styles.rowTrigger, open && styles.rowTriggerOpen).className;
}

export function popupProps(width?: MenuWidth | false) {
  return stylex.props(styles.popup, width);
}

export function scrollProps() {
  return stylex.props(styles.scroll);
}

export function itemClass(state: ItemState, flags?: { inset?: boolean; destructive?: boolean; current?: boolean }): string | undefined {
  return stylex.props(
    styles.item,
    state.highlighted && styles.highlighted,
    state.disabled && styles.disabled,
    flags?.inset && styles.inset,
    flags?.destructive && styles.destructive,
    flags?.current && styles.current,
  ).className;
}

export function radioClass(state: ItemState): string | undefined {
  return stylex.props(styles.radio, state.highlighted && styles.highlighted, state.disabled && styles.disabled).className;
}

export function checkProps() {
  return stylex.props(styles.check);
}

export function indicatorProps() {
  return stylex.props(styles.indicator);
}

export function itemTextProps() {
  return stylex.props(styles.itemText);
}

export function labelClass(inset?: boolean): string | undefined {
  return stylex.props(styles.label, inset && styles.inset).className;
}

export function separatorClass(): string | undefined {
  return stylex.props(styles.separator).className;
}

export function shortcutProps() {
  return stylex.props(styles.shortcut);
}

export function chevronProps() {
  return stylex.props(styles.chevron);
}

export function switchItemClass(state: ItemState): string | undefined {
  return stylex.props(styles.item, styles.spread, state.highlighted && styles.highlighted, state.disabled && styles.disabled).className;
}

export function switchTrackProps(checked: boolean) {
  return stylex.props(styles.switchTrack, checked && styles.switchOn);
}

export function switchThumbProps(checked: boolean) {
  return stylex.props(styles.switchThumb, checked && styles.switchThumbOn);
}
