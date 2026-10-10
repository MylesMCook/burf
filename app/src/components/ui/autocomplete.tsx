"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import * as stylex from "@stylexjs/stylex";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import type React from "react";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";
const coarse = "@media (pointer: coarse)";

const styles = stylex.create({
  group: {
    position: "relative",
    width: "100%",
    color: color.foreground,
    opacity: { default: 1, ":has(:disabled)": 0.64 },
  },
  addon: {
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    bottom: 0,
    insetInlineStart: 1,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    paddingInlineStart: 11,
    opacity: 0.8,
    ":has(+ [data-size=sm])": { paddingInlineStart: 9 },
    ":not(#\\#) svg": { pointerEvents: "none", flexShrink: 0, marginLeft: -2, marginRight: -2, width: { default: 18, [sm]: 16 }, height: { default: 18, [sm]: 16 } },
  },
  iconButton: {
    position: "absolute",
    top: "50%",
    display: "inline-flex",
    width: { default: 32, [sm]: 28 },
    height: { default: 32, [sm]: 28 },
    flexShrink: 0,
    transform: "translateY(-50%)",
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    opacity: { default: 0.8, ":hover": 1 },
    outline: "none",
    transitionProperty: "color, background-color, box-shadow, opacity",
    transitionDuration: "150ms",
    ":not(#\\#) svg": { pointerEvents: "none", flexShrink: 0, width: { default: 18, [sm]: 16 }, height: { default: 18, [sm]: 16 } },
    "::after": {
      content: { [coarse]: '""' },
      position: { [coarse]: "absolute" },
      minWidth: { [coarse]: 44 },
      minHeight: { [coarse]: 44 },
    },
  },
  iconEnd: { insetInlineEnd: 2 },
  iconEndSm: { insetInlineEnd: 0 },
  positioner: { zIndex: 50, userSelect: "none" },
  popup: {
    position: "relative",
    display: "flex",
    maxHeight: "100%",
    minWidth: "var(--anchor-width)",
    maxWidth: "var(--available-width)",
    transformOrigin: "var(--transform-origin)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    boxShadow: "0 10px 15px -3px color-mix(in oklab, var(--foreground) 5%, transparent), 0 4px 6px -4px color-mix(in oklab, var(--foreground) 5%, transparent)",
    transitionProperty: "scale, opacity",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-lg) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
  },
  popupBody: {
    display: "flex",
    maxHeight: "min(var(--available-height), 23rem)",
    flexGrow: 1,
    flexDirection: "column",
    color: color.foreground,
  },
  item: {
    display: "flex",
    minHeight: { default: 32, [sm]: 28 },
    cursor: "default",
    userSelect: "none",
    alignItems: "center",
    borderRadius: radius.sm,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: { default: 16, [sm]: 14 },
    outline: "none",
  },
  itemRoom: { paddingTop: 6, paddingBottom: 6 },
  highlighted: { backgroundColor: color.accent, color: color.accentForeground },
  disabled: { pointerEvents: "none", opacity: 0.64 },
  gap2: { gap: 8 },
  gap25: { gap: 10 },
  textSm: { fontSize: 14 },
  icons: { ":not(#\\#) svg": { width: 16, height: 16, color: color.mutedForeground } },
  model: {
    position: "relative",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: radius.lg,
    paddingTop: 8,
    paddingBottom: 8,
    paddingInlineStart: 12,
    paddingInlineEnd: 36,
    ":not(#\\#) svg": { width: 14, height: 14 },
  },
  separator: {
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 8,
    marginRight: 8,
    height: 1,
    backgroundColor: color.border,
    ":last-child": { display: "none" },
  },
  separatorNone: { marginTop: 0, marginBottom: 0 },
  separatorRoom: { marginTop: 8, marginBottom: 8 },
  bunch: { ":is([role=group] + &)": { marginTop: 6 } },
  label: { paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: color.mutedForeground, fontSize: 12 },
  empty: {
    textAlign: "center",
    fontSize: { default: 16, [sm]: 14 },
    color: color.mutedForeground,
    ":not(:empty)": { padding: 8 },
  },
  emptyRoom: { ":not(:empty)": { paddingTop: 24, paddingBottom: 24 } },
  list: {
    ":not(:empty)": { scrollPaddingTop: 4, scrollPaddingBottom: 4, padding: 4 },
    ":is([data-has-overflow-y] &)": { paddingInlineEnd: 12 },
  },
  listRoom: { ":not(:empty)": { scrollPaddingTop: 8, scrollPaddingBottom: 8, padding: 8 } },
  cap96: { maxHeight: "24rem" },
  hideBar: {
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "::-webkit-scrollbar": { display: "none" },
  },
  status: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
    fontWeight: 500,
    color: color.mutedForeground,
    fontSize: 12,
    ":empty": { margin: 0, padding: 0 },
  },
});

function name(...parts: readonly (false | null | undefined | object)[]): string | undefined {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className;
}

export const Autocomplete: typeof AutocompletePrimitive.Root = AutocompletePrimitive.Root;

export function AutocompleteInput({
  showTrigger = false,
  showClear = false,
  bare = false,
  startAddon,
  size,
  text,
  triggerProps,
  clearProps,
  ...props
}: Omit<AutocompletePrimitive.Input.Props, "size" | "className" | "style"> & {
  showTrigger?: boolean;
  showClear?: boolean;
  bare?: boolean;
  startAddon?: React.ReactNode;
  size?: "sm" | "default" | "lg" | number;
  text?: "default" | "sm" | "xs";
  ref?: React.Ref<HTMLInputElement>;
  triggerProps?: Omit<AutocompletePrimitive.Trigger.Props, "className" | "style">;
  clearProps?: Omit<AutocompletePrimitive.Clear.Props, "className" | "style">;
}): React.ReactElement {
  const sizeValue = (size ?? "default") as "sm" | "default" | "lg" | number;
  const end = showTrigger || showClear ? (sizeValue === "sm" ? "sm" : "icon") : undefined;
  return (
    <AutocompletePrimitive.InputGroup className={name(styles.group)} data-slot="autocomplete-input-group">
      {startAddon && (
        <div aria-hidden="true" className={name(styles.addon)} data-slot="autocomplete-start-addon">
          {startAddon}
        </div>
      )}
      <AutocompletePrimitive.Input
        data-slot="autocomplete-input"
        render={<Input nativeInput size={sizeValue} chrome={bare ? "command" : undefined} text={text} lead={startAddon ? (sizeValue === "sm" ? "sm" : "icon") : undefined} trail={end} />}
        {...props}
      />
      {showTrigger && (
        <AutocompleteTrigger placed end={sizeValue === "sm" ? "flush" : "inset"} {...triggerProps}>
          <AutocompletePrimitive.Icon data-slot="autocomplete-icon">
            <ChevronsUpDownIcon />
          </AutocompletePrimitive.Icon>
        </AutocompleteTrigger>
      )}
      {showClear && (
        <AutocompleteClear end={sizeValue === "sm" ? "flush" : "inset"} {...clearProps}>
          <XIcon />
        </AutocompleteClear>
      )}
    </AutocompletePrimitive.InputGroup>
  );
}

export function AutocompletePopup({
  children,
  side = "bottom",
  sideOffset = 4,
  alignOffset,
  align = "start",
  anchor,
  portalProps,
  ...props
}: Omit<AutocompletePrimitive.Popup.Props, "className" | "style"> & {
  align?: AutocompletePrimitive.Positioner.Props["align"];
  sideOffset?: AutocompletePrimitive.Positioner.Props["sideOffset"];
  alignOffset?: AutocompletePrimitive.Positioner.Props["alignOffset"];
  side?: AutocompletePrimitive.Positioner.Props["side"];
  anchor?: AutocompletePrimitive.Positioner.Props["anchor"];
  portalProps?: AutocompletePrimitive.Portal.Props;
}): React.ReactElement {
  return (
    <AutocompletePrimitive.Portal {...portalProps}>
      <AutocompletePrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className={name(styles.positioner)}
        data-slot="autocomplete-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <span className={name(styles.popup)}>
          <AutocompletePrimitive.Popup className={name(styles.popupBody)} data-slot="autocomplete-popup" {...props}>
            {children}
          </AutocompletePrimitive.Popup>
        </span>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  );
}

export type AutocompleteItemLook = "model";

export function AutocompleteItem({
  children,
  gap,
  text,
  icons = false,
  look,
  pad = "default",
  ...props
}: Omit<AutocompletePrimitive.Item.Props, "className" | "style"> & {
  gap?: 2 | 2.5;
  text?: "sm";
  icons?: boolean;
  look?: AutocompleteItemLook;
  pad?: "default" | "command";
}): React.ReactElement {
  return (
    <AutocompletePrimitive.Item
      className={(state) =>
        name(
          styles.item,
          pad === "command" && styles.itemRoom,
          state.highlighted && styles.highlighted,
          state.disabled && styles.disabled,
          gap === 2 && styles.gap2,
          gap === 2.5 && styles.gap25,
          text === "sm" && styles.textSm,
          icons && styles.icons,
          look === "model" && styles.model,
        )
      }
      data-slot="autocomplete-item"
      {...props}
    >
      {children}
    </AutocompletePrimitive.Item>
  );
}

export function AutocompleteSeparator({
  space = "default",
  ...props
}: Omit<AutocompletePrimitive.Separator.Props, "className" | "style"> & {
  space?: "none" | "default" | "room";
}): React.ReactElement {
  return (
    <AutocompletePrimitive.Separator
      className={name(styles.separator, space === "none" && styles.separatorNone, space === "room" && styles.separatorRoom)}
      data-slot="autocomplete-separator"
      {...props}
    />
  );
}

export function AutocompleteGroup(props: Omit<AutocompletePrimitive.Group.Props, "className" | "style">): React.ReactElement {
  return <AutocompletePrimitive.Group className={name(styles.bunch)} data-slot="autocomplete-group" {...props} />;
}

export function AutocompleteGroupLabel(props: Omit<AutocompletePrimitive.GroupLabel.Props, "className" | "style">): React.ReactElement {
  return <AutocompletePrimitive.GroupLabel className={name(styles.label)} data-slot="autocomplete-group-label" {...props} />;
}

export function AutocompleteEmpty({
  pad = "default",
  ...props
}: Omit<AutocompletePrimitive.Empty.Props, "className" | "style"> & { pad?: "default" | "room" }): React.ReactElement {
  return <AutocompletePrimitive.Empty className={name(styles.empty, pad === "room" && styles.emptyRoom)} data-slot="autocomplete-empty" {...props} />;
}

export function AutocompleteRow(props: Omit<AutocompletePrimitive.Row.Props, "className" | "style">): React.ReactElement {
  return <AutocompletePrimitive.Row data-slot="autocomplete-row" {...props} />;
}

export const AutocompleteValue: typeof AutocompletePrimitive.Value = AutocompletePrimitive.Value;

export function AutocompleteList({
  pad = "default",
  cap,
  hideBar = false,
  ...props
}: Omit<AutocompletePrimitive.List.Props, "className" | "style"> & {
  pad?: "default" | "room";
  cap?: "96";
  hideBar?: boolean;
}): React.ReactElement {
  return (
    <ScrollArea overscrollContain scrollbarGutter scrollFade>
      <AutocompletePrimitive.List
        className={name(styles.list, pad === "room" && styles.listRoom, cap === "96" && styles.cap96, hideBar && styles.hideBar)}
        data-slot="autocomplete-list"
        {...props}
      />
    </ScrollArea>
  );
}

export function AutocompleteClear({
  children,
  end = "inset",
  ...props
}: Omit<AutocompletePrimitive.Clear.Props, "className" | "style"> & { end?: "inset" | "flush" }): React.ReactElement {
  return (
    <AutocompletePrimitive.Clear className={name(styles.iconButton, end === "flush" ? styles.iconEndSm : styles.iconEnd)} data-slot="autocomplete-clear" {...props}>
      {children ?? <XIcon />}
    </AutocompletePrimitive.Clear>
  );
}

export function AutocompleteStatus(props: Omit<AutocompletePrimitive.Status.Props, "className" | "style">): React.ReactElement {
  return <AutocompletePrimitive.Status className={name(styles.status)} data-slot="autocomplete-status" {...props} />;
}

export const AutocompleteCollection: typeof AutocompletePrimitive.Collection = AutocompletePrimitive.Collection;

export function AutocompleteTrigger({
  placed = false,
  end = "inset",
  children,
  ...props
}: Omit<AutocompletePrimitive.Trigger.Props, "className" | "style"> & {
  placed?: boolean;
  end?: "inset" | "flush";
}): React.ReactElement {
  return (
    <AutocompletePrimitive.Trigger
      className={placed ? name(styles.iconButton, end === "flush" ? styles.iconEndSm : styles.iconEnd) : undefined}
      data-slot="autocomplete-trigger"
      {...props}
    >
      {children}
    </AutocompletePrimitive.Trigger>
  );
}

export const useAutocompleteFilter: typeof AutocompletePrimitive.useFilter = AutocompletePrimitive.useFilter;

export { AutocompletePrimitive };
