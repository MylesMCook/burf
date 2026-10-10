"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { platformKeys } from "@/lib/platform";
import {
  checkProps,
  chevronProps,
  itemClass,
  labelClass,
  menuWidths,
  popupProps,
  positionerClass,
  rowTriggerClass,
  radioClass,
  scrollProps,
  separatorClass,
  shortcutProps,
  switchItemClass,
  switchThumbProps,
  switchTrackProps,
  type MenuWidth,
} from "@/components/ui/menu-styles";

export { menuWidths };
export type { MenuWidth };

export const ContextMenu: typeof ContextMenuPrimitive.Root = ContextMenuPrimitive.Root;

export const ContextMenuPortal: typeof ContextMenuPrimitive.Portal = ContextMenuPrimitive.Portal;

export function ContextMenuTrigger({
  children,
  fill,
  ...props
}: Omit<ContextMenuPrimitive.Trigger.Props, "className"> & {
  fill?: "row";
}): React.ReactElement {
  return (
    <ContextMenuPrimitive.Trigger
      className={fill === "row" ? (state) => rowTriggerClass(state.open) : undefined}
      data-slot="context-menu-trigger"
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Trigger>
  );
}

export function ContextMenuPopup({
  children,
  width,
  sideOffset = 4,
  align = "center",
  alignOffset,
  side = "bottom",
  anchor,
  portalProps,
  ...props
}: Omit<ContextMenuPrimitive.Popup.Props, "className" | "style"> & {
  align?: ContextMenuPrimitive.Positioner.Props["align"];
  sideOffset?: ContextMenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: ContextMenuPrimitive.Positioner.Props["alignOffset"];
  side?: ContextMenuPrimitive.Positioner.Props["side"];
  anchor?: ContextMenuPrimitive.Positioner.Props["anchor"];
  portalProps?: ContextMenuPrimitive.Portal.Props;
  width?: MenuWidth;
}): React.ReactElement {
  const visual = popupProps(width);
  return (
    <ContextMenuPortal {...portalProps}>
      <ContextMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className={positionerClass()}
        data-slot="context-menu-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-popup"
          {...props}
          render={(base) => {
            const { children: popupChildren, ...rest } = base;
            return (
              <div {...mergeProps(visual, rest)}>
                <div {...scrollProps()}>{popupChildren}</div>
              </div>
            );
          }}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPortal>
  );
}

export function ContextMenuGroup(props: ContextMenuPrimitive.Group.Props): React.ReactElement {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}

export function ContextMenuItem({
  inset,
  variant = "default",
  ...props
}: Omit<ContextMenuPrimitive.Item.Props, "className"> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}): React.ReactElement {
  const flags = { inset, destructive: variant === "destructive" };
  return (
    <ContextMenuPrimitive.Item
      className={(state) => itemClass(state, flags)}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

export function ContextMenuLinkItem({
  inset,
  variant = "default",
  closeOnClick = true,
  ...props
}: Omit<ContextMenuPrimitive.LinkItem.Props, "className"> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}): React.ReactElement {
  const flags = { inset, destructive: variant === "destructive" };
  return (
    <ContextMenuPrimitive.LinkItem
      className={(state) => itemClass({ highlighted: state.highlighted }, flags)}
      closeOnClick={closeOnClick}
      data-inset={inset}
      data-slot="context-menu-link-item"
      data-variant={variant}
      {...props}
    />
  );
}

function Check() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" {...checkProps()}>
      <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
    </svg>
  );
}

export function ContextMenuCheckboxItem({
  children,
  checked,
  variant = "default",
  ...props
}: Omit<ContextMenuPrimitive.CheckboxItem.Props, "className"> & {
  variant?: "default" | "switch";
}): React.ReactElement {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={(state) => (variant === "switch" ? switchItemClass(state) : radioClass(state))}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      {variant === "switch" ? (
        <>
          <span>{children}</span>
          <ContextMenuPrimitive.CheckboxItemIndicator
            keepMounted
            render={(indicatorProps, state) => (
              <span {...mergeProps(switchTrackProps(state.checked), indicatorProps)}>
                <span {...switchThumbProps(state.checked)} />
              </span>
            )}
          />
        </>
      ) : (
        <>
          <ContextMenuPrimitive.CheckboxItemIndicator>
            <Check />
          </ContextMenuPrimitive.CheckboxItemIndicator>
          <span>{children}</span>
        </>
      )}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

export function ContextMenuRadioGroup(props: ContextMenuPrimitive.RadioGroup.Props): React.ReactElement {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />;
}

export function ContextMenuRadioItem({ children, ...props }: Omit<ContextMenuPrimitive.RadioItem.Props, "className">): React.ReactElement {
  return (
    <ContextMenuPrimitive.RadioItem className={(state) => radioClass(state)} data-slot="context-menu-radio-item" {...props}>
      <ContextMenuPrimitive.RadioItemIndicator>
        <Check />
      </ContextMenuPrimitive.RadioItemIndicator>
      <span>{children}</span>
    </ContextMenuPrimitive.RadioItem>
  );
}

export function ContextMenuGroupLabel({
  inset,
  ...props
}: Omit<ContextMenuPrimitive.GroupLabel.Props, "className"> & {
  inset?: boolean;
}): React.ReactElement {
  return <ContextMenuPrimitive.GroupLabel className={labelClass(inset)} data-inset={inset} data-slot="context-menu-label" {...props} />;
}

export function ContextMenuSeparator(props: Omit<ContextMenuPrimitive.Separator.Props, "className">): React.ReactElement {
  return <ContextMenuPrimitive.Separator className={separatorClass()} data-slot="context-menu-separator" {...props} />;
}

export function ContextMenuShortcut({ children, ...props }: Omit<React.ComponentProps<"kbd">, "className">): React.ReactElement {
  return (
    <kbd {...shortcutProps()} data-slot="context-menu-shortcut" {...props}>
      {typeof children === "string" ? platformKeys(children) : children}
    </kbd>
  );
}

export function ContextMenuSub(props: ContextMenuPrimitive.SubmenuRoot.Props): React.ReactElement {
  return <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />;
}

export function ContextMenuSubTrigger({
  inset,
  children,
  ...props
}: Omit<ContextMenuPrimitive.SubmenuTrigger.Props, "className"> & {
  inset?: boolean;
}): React.ReactElement {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      className={(state) => itemClass({ highlighted: state.highlighted || state.open, disabled: state.disabled }, { inset })}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon {...chevronProps()} />
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

export function ContextMenuSubPopup({
  width,
  sideOffset = 0,
  alignOffset,
  align = "start",
  ...props
}: Omit<ContextMenuPrimitive.Popup.Props, "className" | "style"> & {
  align?: ContextMenuPrimitive.Positioner.Props["align"];
  sideOffset?: ContextMenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: ContextMenuPrimitive.Positioner.Props["alignOffset"];
  width?: MenuWidth;
}): React.ReactElement {
  const defaultAlignOffset = align !== "center" ? -5 : undefined;
  return (
    <ContextMenuPopup
      align={align}
      alignOffset={alignOffset ?? defaultAlignOffset}
      data-slot="context-menu-sub-content"
      side="inline-end"
      sideOffset={sideOffset}
      width={width}
      {...props}
    />
  );
}

export { ContextMenuPrimitive };
