"use client";

import { Dialog as CommandDialogPrimitive } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";
import { SearchIcon } from "lucide-react";
import type * as React from "react";

import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  type AutocompleteItemLook,
  AutocompleteList,
  AutocompleteSeparator,
} from "@/components/ui/autocomplete";
import { FocusRescue } from "@/lib/focus-home";
import { color, font, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";
const still = "@media (prefers-reduced-motion: reduce)";

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
  viewport: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: { default: "max(1rem, 4vh)", [sm]: "10vh" },
    paddingBottom: { default: "max(1rem, 4vh)", [sm]: "10vh" },
  },
  popup: {
    position: "relative",
    gridRowStart: 2,
    display: "flex",
    maxHeight: "26.25rem",
    minHeight: 0,
    width: "100%",
    minWidth: 0,
    maxWidth: "36rem",
    flexDirection: "column",
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    color: color.popoverForeground,
    opacity: "calc(1 - 0.1 * var(--nested-dialogs, 0))",
    translate: "0 calc(-1.25rem * var(--nested-dialogs, 0))",
    scale: "calc(1 - 0.1 * var(--nested-dialogs, 0))",
    boxShadow: "0 10px 15px -3px color-mix(in oklab, var(--foreground) 5%, transparent), 0 4px 6px -4px color-mix(in oklab, var(--foreground) 5%, transparent)",
    outline: "none",
    transitionProperty: "scale, opacity, translate",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "ease-in-out",
    willChange: "transform",
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-2xl) - 1px)",
      backgroundColor: "color-mix(in oklab, var(--muted) 72%, transparent)",
      boxShadow: "var(--dialog-edge)",
    },
    ":not(#\\#) [data-slot=scroll-area-viewport][data-has-overflow-y]": { paddingInlineEnd: 4 },
  },
  fade: { opacity: 0, scale: 0.98 },
  nestedShift: { translate: "0 2rem" },
  nestedOpen: { transformOrigin: "top" },
  files: { maxHeight: "min(32rem, 80vh)", maxWidth: "42rem" },
  preview: { height: "min(36rem, 82vh)", maxHeight: "min(36rem, 82vh)", maxWidth: "64rem" },
  field: { paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10 },
  panel: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    marginLeft: -1,
    marginRight: -1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    backgroundClip: "padding-box",
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    clipPath: "inset(0 1px)",
    ":not(:has(+ [data-slot=command-footer]))": {
      marginBottom: -1,
      borderBottomLeftRadius: radius.xxl,
      borderBottomRightRadius: radius.xxl,
      clipPath: "inset(0 1px 1px 1px round 0 0 calc(var(--radius-2xl) - 1px) calc(var(--radius-2xl) - 1px))",
    },
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderTopLeftRadius: "calc(var(--radius-xl) - 1px)",
      borderTopRightRadius: "calc(var(--radius-xl) - 1px)",
    },
    ":not(#\\#) [data-slot=scroll-area-scrollbar]": { marginTop: 8 },
  },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  shortcut: {
    marginInlineStart: "auto",
    fontWeight: 500,
    fontFamily: font.sans,
    color: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    fontSize: 12,
    letterSpacing: "0.1em",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomLeftRadius: "calc(var(--radius-2xl) - 1px)",
    borderBottomRightRadius: "calc(var(--radius-2xl) - 1px)",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 20,
    color: color.mutedForeground,
    fontSize: 11,
  },
  footerStart: { justifyContent: "flex-start" },
  footerGap: { gap: 16 },
});

function name(...parts: readonly (false | null | undefined | object)[]): string | undefined {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className;
}

function moving(status: string | undefined): boolean {
  return status === "starting" || status === "ending";
}

export const CommandDialog: typeof CommandDialogPrimitive.Root = CommandDialogPrimitive.Root;
export const CommandDialogPortal: typeof CommandDialogPrimitive.Portal = CommandDialogPrimitive.Portal;
export const CommandCreateHandle: typeof CommandDialogPrimitive.createHandle = CommandDialogPrimitive.createHandle;

export function CommandDialogTrigger(props: Omit<CommandDialogPrimitive.Trigger.Props, "className" | "style">): React.ReactElement {
  return <CommandDialogPrimitive.Trigger data-slot="command-dialog-trigger" {...props} />;
}

export function CommandDialogBackdrop(props: Omit<CommandDialogPrimitive.Backdrop.Props, "className" | "style">): React.ReactElement {
  return (
    <CommandDialogPrimitive.Backdrop
      className={(state) => name(styles.backdrop, moving(state.transitionStatus) && styles.gone)}
      data-slot="command-dialog-backdrop"
      {...props}
    />
  );
}

export function CommandDialogViewport(props: Omit<CommandDialogPrimitive.Viewport.Props, "className" | "style">): React.ReactElement {
  return <CommandDialogPrimitive.Viewport className={name(styles.viewport)} data-slot="command-dialog-viewport" {...props} />;
}

export type CommandPopupSize = "default" | "files" | "preview";

export function CommandDialogPopup({
  children,
  portalProps,
  size = "default",
  ...props
}: Omit<CommandDialogPrimitive.Popup.Props, "className" | "style"> & {
  portalProps?: CommandDialogPrimitive.Portal.Props;
  size?: CommandPopupSize;
}): React.ReactElement {
  return (
    <CommandDialogPortal {...portalProps}>
      <CommandDialogBackdrop />
      <CommandDialogViewport>
        <CommandDialogPrimitive.Popup
          className={(state) =>
            name(
              styles.popup,
              size === "files" && styles.files,
              size === "preview" && styles.preview,
              moving(state.transitionStatus) && styles.fade,
              state.nested && moving(state.transitionStatus) && styles.nestedShift,
              state.nestedDialogOpen && styles.nestedOpen,
            )
          }
          data-slot="command-dialog-popup"
          {...props}
        >
          <FocusRescue />
          {children}
        </CommandDialogPrimitive.Popup>
      </CommandDialogViewport>
    </CommandDialogPortal>
  );
}

export function Command({
  autoHighlight = "always",
  keepHighlight = true,
  ...props
}: React.ComponentProps<typeof Autocomplete>): React.ReactElement {
  return <Autocomplete autoHighlight={autoHighlight} inline keepHighlight={keepHighlight} open {...props} />;
}

export function CommandInput({
  placeholder = undefined,
  text,
  ...props
}: Omit<React.ComponentProps<typeof AutocompleteInput>, "bare" | "startAddon" | "size">): React.ReactElement {
  return (
    <div className={name(styles.field)}>
      <AutocompleteInput autoFocus bare placeholder={placeholder} size="lg" startAddon={<SearchIcon />} text={text} {...props} />
    </div>
  );
}

export function CommandList({
  cap,
  hideBar = false,
  ...props
}: Omit<React.ComponentProps<typeof AutocompleteList>, "pad"> & { cap?: "96"; hideBar?: boolean }): React.ReactElement {
  return <AutocompleteList cap={cap} hideBar={hideBar} pad="room" data-slot="command-list" {...props} />;
}

export function CommandEmpty(props: Omit<React.ComponentProps<typeof AutocompleteEmpty>, "pad">): React.ReactElement {
  return <AutocompleteEmpty pad="room" data-slot="command-empty" {...props} />;
}

export function CommandPanel({
  grow = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & { grow?: boolean }): React.ReactElement {
  return <div className={name(styles.panel, grow && styles.grow)} data-slot="command-panel" {...props} />;
}

export function CommandGroup(props: React.ComponentProps<typeof AutocompleteGroup>): React.ReactElement {
  return <AutocompleteGroup data-slot="command-group" {...props} />;
}

export function CommandGroupLabel(props: React.ComponentProps<typeof AutocompleteGroupLabel>): React.ReactElement {
  return <AutocompleteGroupLabel data-slot="command-group-label" {...props} />;
}

export const CommandCollection = AutocompleteCollection;

export function CommandItem({
  look,
  ...props
}: Omit<React.ComponentProps<typeof AutocompleteItem>, "pad"> & { look?: AutocompleteItemLook }): React.ReactElement {
  return <AutocompleteItem pad="command" look={look} data-slot="command-item" {...props} />;
}

export function CommandSeparator(props: React.ComponentProps<typeof AutocompleteSeparator>): React.ReactElement {
  return <AutocompleteSeparator space="room" data-slot="command-separator" {...props} />;
}

export function CommandShortcut(props: Omit<React.ComponentProps<"kbd">, "className" | "style">): React.ReactElement {
  return <kbd className={name(styles.shortcut)} data-slot="command-shortcut" {...props} />;
}

export function CommandFooter({
  align = "between",
  gap = 2,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & {
  align?: "between" | "start";
  gap?: 2 | 4;
}): React.ReactElement {
  return <div className={name(styles.footer, align === "start" && styles.footerStart, gap === 4 && styles.footerGap)} data-slot="command-footer" {...props} />;
}

export { CommandDialogPrimitive };
