"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from "lucide-react";
import type * as React from "react";

import { color, radius } from "@/styles/tokens.stylex";
import { overlay } from "@/components/ui/overlay-tokens.stylex";


const sm = "@media (min-width: 640px)";
const coarse = "@media (pointer: coarse)";

const styles = stylex.create({
  trigger: {
    position: "relative",
    display: "inline-flex",
    width: "100%",
    minWidth: 144,
    minHeight: { default: 36, [sm]: 32, [coarse]: 44 },
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    userSelect: "none",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: color.input,
      ":focus-visible": color.ring,
      '[aria-invalid="true"]': "color-mix(in oklab, var(--destructive) 36%, transparent)",
      ':focus-visible[aria-invalid="true"]': "color-mix(in oklab, var(--destructive) 64%, transparent)",
    },
    backgroundColor: "var(--control-fill)",
    backgroundClip: "padding-box",
    paddingLeft: 11,
    paddingRight: 11,
    textAlign: "left",
    color: color.foreground,
    fontSize: { default: 16, [sm]: 14 },
    boxShadow: {
      default: "none",
      ":focus-visible": "0 0 0 3px color-mix(in oklab, var(--ring) 24%, transparent)",
      ':focus-visible[aria-invalid="true"]': "0 0 0 3px var(--invalid-ring)",
      ":disabled": "none",
      '[aria-invalid="true"]': "none",
      ":active": "none",
    },
    outline: "none",
    opacity: { default: 1, ":disabled": 0.64 },
    pointerEvents: { default: "auto", ":disabled": "none" },
    transitionProperty: "box-shadow",
  },
  xs: {
    minHeight: 24,
    height: 24,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 11,
  },
  sm: {
    minHeight: { default: 32, [sm]: 28, [coarse]: 44 },
    gap: 6,
    paddingLeft: 9,
    paddingRight: 9,
  },
  lg: { minHeight: { default: 40, [sm]: 36, [coarse]: 44 } },
  pill: {
    width: "auto",
    minWidth: 0,
    height: 28,
    minHeight: 28,
    flexShrink: 0,
    justifyContent: "flex-start",
    gap: 4,
    borderWidth: 0,
    borderRadius: radius.full,
    backgroundColor: { default: "transparent", ":hover": color.muted },
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 12,
    boxShadow: "none",
    "::before": { boxShadow: "none" },
  },
  grow: { minWidth: 0 },
  w32: { width: 128, minWidth: 0 },
  w40: { width: 160, minWidth: 0 },
  w56: { width: 224, minWidth: 0 },
  value: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  placeholder: { color: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)" },
  icon: {
    width: { default: 18, [sm]: 16 },
    height: { default: 18, [sm]: 16 },
    marginRight: -4,
    opacity: 0.8,
    flexShrink: 0,
    pointerEvents: "none",
  },
  positioner: {
    zIndex: 50,
    height: "var(--positioner-height)",
    width: "var(--positioner-width)",
    maxWidth: "var(--available-width)",
    userSelect: "none",
    transitionProperty: "top, left, right, bottom, transform",
  },
  popup: {
    transformOrigin: "var(--transform-origin)",
    color: color.foreground,
    outline: "none",
  },
  surface: {
    position: "relative",
    height: "100%",
    minWidth: "var(--anchor-width)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    boxShadow: overlay.shadow,
  },
  list: {
    maxHeight: "var(--available-height)",
    overflowY: "auto",
    padding: 4,
  },
  arrow: {
    position: "absolute",
    zIndex: 50,
    display: "flex",
    height: 24,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      left: 1,
      right: 1,
      height: "200%",
      backgroundColor: color.popover,
    },
  },
  arrowUp: { top: 0, "::before": { top: 1, borderTopLeftRadius: "calc(var(--radius-lg) - 1px)", borderTopRightRadius: "calc(var(--radius-lg) - 1px)" } },
  arrowDown: { bottom: 0, "::before": { bottom: 1, borderBottomLeftRadius: "calc(var(--radius-lg) - 1px)", borderBottomRightRadius: "calc(var(--radius-lg) - 1px)" } },
  arrowIcon: { position: "relative", width: { default: 18, [sm]: 16 }, height: { default: 18, [sm]: 16 } },
  item: {
    display: "grid",
    minHeight: { default: 32, [sm]: 28 },
    minWidth: { ":is([data-side='none'] &)": "calc(var(--anchor-width) + 1.25rem)" },
    cursor: "default",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 16,
    fontSize: { default: 16, [sm]: 14 },
    outline: "none",
  },
  itemOn: { backgroundColor: color.accent, color: color.accentForeground },
  itemOff: { pointerEvents: "none", opacity: 0.64 },
  mark: { gridColumnStart: 1, width: 16, height: 16 },
  text: { gridColumnStart: 2, minWidth: 0, overflowWrap: "anywhere" },
  separator: { marginTop: 4, marginBottom: 4, marginLeft: 8, marginRight: 8, height: 1, backgroundColor: color.border },
  label: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    fontWeight: 500,
    fontSize: { default: 16, [sm]: 14 },
    lineHeight: { default: "18px", [sm]: "16px" },
    color: color.foreground,
  },
  groupLabel: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    fontWeight: 500,
    fontSize: 12,
    color: color.mutedForeground,
  },
});

export type SelectSize = "xs" | "sm" | "default" | "lg";
export type SelectMeasure = "fill" | "grow" | "32" | "40" | "56";
export type SelectShape = "field" | "pill";

const sizeStyle = { xs: styles.xs, sm: styles.sm, default: false, lg: styles.lg } as const;
const measureStyle = { fill: false, grow: styles.grow, "32": styles.w32, "40": styles.w40, "56": styles.w56 } as const;

function iconClass(): string | undefined {
  return stylex.props(styles.icon).className;
}

export const Select: typeof SelectPrimitive.Root = SelectPrimitive.Root;

export interface SelectButtonProps extends Omit<useRender.ComponentProps<"button">, "className" | "style"> {
  size?: SelectSize;
  measure?: SelectMeasure;
}

export function SelectButton({
  size = "default",
  measure = "grow",
  render,
  children,
  ...props
}: SelectButtonProps): React.ReactElement {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] = render ? undefined : "button";
  const painted = stylex.props(styles.trigger, sizeStyle[size], measureStyle[measure]);
  const defaultProps = {
    children: (
      <>
        <span {...stylex.props(styles.value)}>{children}</span>
        <ChevronsUpDownIcon className={iconClass()} />
      </>
    ),
    ...painted,
    "data-slot": "select-button",
    type: typeValue,
  };
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export function SelectTrigger({
  size = "default",
  measure = "fill",
  shape = "field",
  children,
  ...props
}: Omit<SelectPrimitive.Trigger.Props, "className" | "style"> & {
  size?: SelectSize;
  measure?: SelectMeasure;
  shape?: SelectShape;
}): React.ReactElement {
  return (
    <SelectPrimitive.Trigger
      className={stylex.props(styles.trigger, sizeStyle[size], measureStyle[measure], shape === "pill" && styles.pill).className}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon">
        <ChevronsUpDownIcon className={iconClass()} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue(props: Omit<SelectPrimitive.Value.Props, "className" | "style">): React.ReactElement {
  return (
    <SelectPrimitive.Value
      className={(state) => stylex.props(styles.value, state.placeholder && styles.placeholder).className}
      data-slot="select-value"
      {...props}
    />
  );
}

export function SelectPopup({
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = true,
  anchor,
  portalProps,
  ...props
}: Omit<SelectPrimitive.Popup.Props, "className" | "style"> & {
  portalProps?: SelectPrimitive.Portal.Props;
  side?: SelectPrimitive.Positioner.Props["side"];
  sideOffset?: SelectPrimitive.Positioner.Props["sideOffset"];
  align?: SelectPrimitive.Positioner.Props["align"];
  alignOffset?: SelectPrimitive.Positioner.Props["alignOffset"];
  alignItemWithTrigger?: SelectPrimitive.Positioner.Props["alignItemWithTrigger"];
  anchor?: SelectPrimitive.Positioner.Props["anchor"];
}): React.ReactElement {
  return (
    <SelectPrimitive.Portal {...portalProps}>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        anchor={anchor}
        className={stylex.props(styles.positioner).className}
        data-slot="select-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup className={stylex.props(styles.popup).className} data-slot="select-popup" {...props}>
          <SelectPrimitive.ScrollUpArrow className={stylex.props(styles.arrow, styles.arrowUp).className} data-slot="select-scroll-up-arrow">
            <ChevronUpIcon className={stylex.props(styles.arrowIcon).className} />
          </SelectPrimitive.ScrollUpArrow>
          <div {...stylex.props(styles.surface)}>
            <SelectPrimitive.List className={stylex.props(styles.list).className} data-slot="select-list">
              {children}
            </SelectPrimitive.List>
          </div>
          <SelectPrimitive.ScrollDownArrow className={stylex.props(styles.arrow, styles.arrowDown).className} data-slot="select-scroll-down-arrow">
            <ChevronDownIcon className={stylex.props(styles.arrowIcon).className} />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  children,
  ...props
}: Omit<SelectPrimitive.Item.Props, "className" | "style">): React.ReactElement {
  return (
    <SelectPrimitive.Item
      className={(state) =>
        stylex.props(styles.item, state.highlighted && styles.itemOn, state.disabled && styles.itemOff).className
      }
      data-slot="select-item"
      {...props}
    >
      <SelectPrimitive.ItemIndicator className={stylex.props(styles.mark).className}>
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
        </svg>
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className={stylex.props(styles.text).className}>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator(props: Omit<SelectPrimitive.Separator.Props, "className" | "style">): React.ReactElement {
  return <SelectPrimitive.Separator className={stylex.props(styles.separator).className} data-slot="select-separator" {...props} />;
}

export function SelectGroup(props: SelectPrimitive.Group.Props): React.ReactElement {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

export function SelectLabel(props: Omit<SelectPrimitive.Label.Props, "className" | "style">): React.ReactElement {
  return <SelectPrimitive.Label className={stylex.props(styles.label).className} data-slot="select-label" {...props} />;
}

export function SelectGroupLabel(props: Omit<SelectPrimitive.GroupLabel.Props, "className" | "style">): React.ReactElement {
  return <SelectPrimitive.GroupLabel className={stylex.props(styles.groupLabel).className} data-slot="select-group-label" {...props} />;
}

export { SelectPrimitive, SelectPopup as SelectContent };
