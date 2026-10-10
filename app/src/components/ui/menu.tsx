"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { platformKeys } from "@/lib/platform";
import {
  checkProps,
  chevronProps,
  itemClass,
  indicatorProps,
  itemTextProps,
  labelClass,
  menuWidths,
  popupProps,
  positionerClass,
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

export const MenuCreateHandle: typeof MenuPrimitive.createHandle = MenuPrimitive.createHandle;

export const Menu: typeof MenuPrimitive.Root = MenuPrimitive.Root;

export const MenuPortal: typeof MenuPrimitive.Portal = MenuPrimitive.Portal;

export function MenuTrigger({ children, ...props }: Omit<MenuPrimitive.Trigger.Props, "className">): React.ReactElement {
  return (
    <MenuPrimitive.Trigger data-slot="menu-trigger" {...props}>
      {children}
    </MenuPrimitive.Trigger>
  );
}

export function MenuPopup({
  children,
  width,
  sideOffset = 4,
  align = "center",
  alignOffset,
  side = "bottom",
  anchor,
  portalProps,
  ...props
}: Omit<MenuPrimitive.Popup.Props, "className" | "style"> & {
  align?: MenuPrimitive.Positioner.Props["align"];
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
  side?: MenuPrimitive.Positioner.Props["side"];
  anchor?: MenuPrimitive.Positioner.Props["anchor"];
  portalProps?: MenuPrimitive.Portal.Props;
  width?: MenuWidth;
}): React.ReactElement {
  const visual = popupProps(width);
  return (
    <MenuPortal {...portalProps}>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className={positionerClass()}
        data-slot="menu-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="menu-popup"
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
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPortal>
  );
}

export function MenuGroup(props: MenuPrimitive.Group.Props): React.ReactElement {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

export function MenuItem({
  inset,
  variant = "default",
  current = false,
  ...props
}: Omit<MenuPrimitive.Item.Props, "className"> & {
  inset?: boolean;
  variant?: "default" | "destructive";
  current?: boolean;
}): React.ReactElement {
  const flags = { inset, destructive: variant === "destructive", current };
  return (
    <MenuPrimitive.Item
      className={(state) => itemClass(state, flags)}
      data-inset={inset}
      data-slot="menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

export function MenuLinkItem({
  inset,
  variant = "default",
  closeOnClick = true,
  ...props
}: Omit<MenuPrimitive.LinkItem.Props, "className"> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}): React.ReactElement {
  const flags = { inset, destructive: variant === "destructive" };
  return (
    <MenuPrimitive.LinkItem
      className={(state) => itemClass({ highlighted: state.highlighted }, flags)}
      closeOnClick={closeOnClick}
      data-inset={inset}
      data-slot="menu-link-item"
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

export function MenuCheckboxItem({
  children,
  checked,
  variant = "default",
  ...props
}: Omit<MenuPrimitive.CheckboxItem.Props, "className"> & {
  variant?: "default" | "switch";
}): React.ReactElement {
  return (
    <MenuPrimitive.CheckboxItem
      checked={checked}
      className={(state) => (variant === "switch" ? switchItemClass(state) : radioClass(state))}
      data-slot="menu-checkbox-item"
      {...props}
    >
      {variant === "switch" ? (
        <>
          <span>{children}</span>
          <MenuPrimitive.CheckboxItemIndicator
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
          <MenuPrimitive.CheckboxItemIndicator {...indicatorProps()}>
            <Check />
          </MenuPrimitive.CheckboxItemIndicator>
          <span {...itemTextProps()}>{children}</span>
        </>
      )}
    </MenuPrimitive.CheckboxItem>
  );
}

export function MenuRadioGroup(props: MenuPrimitive.RadioGroup.Props): React.ReactElement {
  return <MenuPrimitive.RadioGroup data-slot="menu-radio-group" {...props} />;
}

export function MenuRadioItem({ children, ...props }: Omit<MenuPrimitive.RadioItem.Props, "className">): React.ReactElement {
  return (
    <MenuPrimitive.RadioItem className={(state) => radioClass(state)} data-slot="menu-radio-item" {...props}>
      <MenuPrimitive.RadioItemIndicator {...indicatorProps()}>
        <Check />
      </MenuPrimitive.RadioItemIndicator>
      <span {...itemTextProps()}>{children}</span>
    </MenuPrimitive.RadioItem>
  );
}

export function MenuGroupLabel({
  inset,
  ...props
}: Omit<MenuPrimitive.GroupLabel.Props, "className"> & {
  inset?: boolean;
}): React.ReactElement {
  return <MenuPrimitive.GroupLabel className={labelClass(inset)} data-inset={inset} data-slot="menu-label" {...props} />;
}

export function MenuSeparator(props: Omit<MenuPrimitive.Separator.Props, "className">): React.ReactElement {
  return <MenuPrimitive.Separator className={separatorClass()} data-slot="menu-separator" {...props} />;
}

export function MenuShortcut({ children, ...props }: Omit<React.ComponentProps<"kbd">, "className">): React.ReactElement {
  return (
    <kbd {...shortcutProps()} data-slot="menu-shortcut" {...props}>
      {typeof children === "string" ? platformKeys(children) : children}
    </kbd>
  );
}

export function MenuSub(props: MenuPrimitive.SubmenuRoot.Props): React.ReactElement {
  return <MenuPrimitive.SubmenuRoot data-slot="menu-sub" {...props} />;
}

export function MenuSubTrigger({
  inset,
  children,
  ...props
}: Omit<MenuPrimitive.SubmenuTrigger.Props, "className"> & {
  inset?: boolean;
}): React.ReactElement {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={(state) => itemClass({ highlighted: state.highlighted || state.open, disabled: state.disabled }, { inset })}
      data-inset={inset}
      data-slot="menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon {...chevronProps()} />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export function MenuSubPopup({
  width,
  sideOffset = 0,
  alignOffset,
  align = "start",
  ...props
}: Omit<MenuPrimitive.Popup.Props, "className" | "style"> & {
  align?: MenuPrimitive.Positioner.Props["align"];
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
  width?: MenuWidth;
}): React.ReactElement {
  const defaultAlignOffset = align !== "center" ? -5 : undefined;
  return (
    <MenuPopup
      align={align}
      alignOffset={alignOffset ?? defaultAlignOffset}
      data-slot="menu-sub-content"
      side="inline-end"
      sideOffset={sideOffset}
      width={width}
      {...props}
    />
  );
}

export {
  MenuPrimitive,
  MenuCreateHandle as DropdownMenuCreateHandle,
  Menu as DropdownMenu,
  MenuPortal as DropdownMenuPortal,
  MenuTrigger as DropdownMenuTrigger,
  MenuPopup as DropdownMenuContent,
  MenuGroup as DropdownMenuGroup,
  MenuItem as DropdownMenuItem,
  MenuCheckboxItem as DropdownMenuCheckboxItem,
  MenuRadioGroup as DropdownMenuRadioGroup,
  MenuRadioItem as DropdownMenuRadioItem,
  MenuGroupLabel as DropdownMenuLabel,
  MenuSeparator as DropdownMenuSeparator,
  MenuShortcut as DropdownMenuShortcut,
  MenuSub as DropdownMenuSub,
  MenuSubTrigger as DropdownMenuSubTrigger,
  MenuSubPopup as DropdownMenuSubContent,
};
