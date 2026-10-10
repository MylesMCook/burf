"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { XIcon } from "lucide-react";
import type React from "react";
import { FocusRescue } from "@/lib/focus-home";
import { Button } from "@/components/ui/button";
import {
  closeClass,
  descriptionClass,
  footerClass,
  headerClass,
  mediaCloseClass,
  panelClass,
  popupClass,
  titleClass,
  backdropClass,
  viewportClass,
  type DialogDescriptionSize,
  type DialogFooterPad,
  type DialogFrame,
  type DialogHeaderPad,
  type DialogInset,
  type DialogStack,
  type DialogTitleSize,
  type DialogWidth,
} from "@/components/ui/dialog-chrome";
import { ScrollArea } from "@/components/ui/scroll-area";

export const DialogCreateHandle: typeof DialogPrimitive.createHandle = DialogPrimitive.createHandle;
export const Dialog: typeof DialogPrimitive.Root = DialogPrimitive.Root;
export const DialogPortal: typeof DialogPrimitive.Portal = DialogPrimitive.Portal;

export type {
  DialogDescriptionSize,
  DialogFooterPad,
  DialogFrame,
  DialogHeaderPad,
  DialogInset,
  DialogStack,
  DialogTitleSize,
  DialogWidth,
};

export function DialogTrigger(props: DialogPrimitive.Trigger.Props): React.ReactElement {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogClose(props: DialogPrimitive.Close.Props): React.ReactElement {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function moving(status: string | undefined): boolean {
  return status === "starting" || status === "ending";
}

export function DialogBackdrop(props: Omit<DialogPrimitive.Backdrop.Props, "className" | "style">): React.ReactElement {
  return (
    <DialogPrimitive.Backdrop
      className={(state) => backdropClass(moving(state.transitionStatus))}
      data-slot="dialog-backdrop"
      {...props}
    />
  );
}

export function DialogViewport({
  anchored = false,
  bottom = false,
  ...props
}: Omit<DialogPrimitive.Viewport.Props, "className" | "style"> & {
  anchored?: boolean;
  bottom?: boolean;
}): React.ReactElement {
  return (
    <DialogPrimitive.Viewport
      className={viewportClass(anchored, bottom)}
      data-slot="dialog-viewport"
      {...props}
    />
  );
}

export function DialogPopup({
  children,
  showCloseButton = true,
  bottomStickOnMobile = true,
  anchored = false,
  closeProps,
  portalProps,
  width = "lg",
  frame = "default",
  closeTone = "default",
  marker,
  ...props
}: Omit<DialogPrimitive.Popup.Props, "className" | "style"> & {
  showCloseButton?: boolean;
  bottomStickOnMobile?: boolean;
  // Pinned 12vh from the top instead of centred, for a dialog whose height
  // changes, so its title stays put.
  anchored?: boolean;
  closeProps?: Omit<DialogPrimitive.Close.Props, "className" | "style">;
  portalProps?: DialogPrimitive.Portal.Props;
  width?: DialogWidth;
  frame?: DialogFrame;
  closeTone?: "default" | "media";
  /** Hook classes such as `aui-*`. Concatenated, never a utility. */
  marker?: string;
}): React.ReactElement {
  const painted = (starting: boolean) => {
    const name = popupClass({ width, frame, anchored, bottom: bottomStickOnMobile, starting });
    return marker ? [marker, name].filter(Boolean).join(" ") : name;
  };
  return (
    <DialogPortal {...portalProps}>
      <DialogBackdrop />
      <DialogViewport anchored={anchored} bottom={bottomStickOnMobile}>
        <DialogPrimitive.Popup
          className={(state) => painted(moving(state.transitionStatus))}
          data-slot="dialog-popup"
          {...props}
        >
          <FocusRescue />
          {children}
          {showCloseButton && closeTone === "media" && (
            <span className={closeClass()}>
              <DialogPrimitive.Close aria-label="Close" className={mediaCloseClass()} {...closeProps}>
                <XIcon />
              </DialogPrimitive.Close>
            </span>
          )}
          {showCloseButton && closeTone === "default" && (
            <span className={closeClass()}>
              <DialogPrimitive.Close aria-label="Close" render={<Button size="icon" variant="ghost" />} {...closeProps}>
                <XIcon />
              </DialogPrimitive.Close>
            </span>
          )}
        </DialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  );
}

export function DialogHeader({
  pad = "default",
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className" | "style"> & {
  pad?: DialogHeaderPad;
}): React.ReactElement {
  const defaultProps = {
    className: headerClass(pad),
    "data-slot": "dialog-header",
  };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

export function DialogFooter({
  variant = "default",
  pad,
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className" | "style"> & {
  variant?: "default" | "bare";
  pad?: DialogFooterPad;
}): React.ReactElement {
  const defaultProps = {
    className: footerClass(variant, pad),
    "data-slot": "dialog-footer",
    "data-variant": variant,
  };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

export function DialogTitle({
  size = "xl",
  row = false,
  truncate = false,
  shrink = false,
  hidden = false,
  marker,
  ...props
}: Omit<DialogPrimitive.Title.Props, "className" | "style"> & {
  size?: DialogTitleSize;
  row?: boolean;
  truncate?: boolean;
  shrink?: boolean;
  hidden?: boolean;
  marker?: string;
}): React.ReactElement {
  const name = titleClass({ size, row, truncate, shrink, hidden });
  return (
    <DialogPrimitive.Title
      className={marker ? [marker, name].filter(Boolean).join(" ") : name}
      data-slot="dialog-title"
      {...props}
    />
  );
}

export function DialogDescription({
  size = "sm",
  mono = false,
  hidden = false,
  nudge = false,
  ...props
}: Omit<DialogPrimitive.Description.Props, "className" | "style"> & {
  size?: DialogDescriptionSize;
  mono?: boolean;
  hidden?: boolean;
  nudge?: boolean;
}): React.ReactElement {
  return (
    <DialogPrimitive.Description
      className={descriptionClass({ size, mono, hidden, nudge })}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export function DialogPanel({
  scrollFade = true,
  contentSize = "default",
  inset = "default",
  stack,
  drop = false,
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className" | "style"> & {
  scrollFade?: boolean;
  contentSize?: "default" | "container";
  inset?: DialogInset;
  stack?: DialogStack;
  drop?: boolean;
}): React.ReactElement {
  const defaultProps = {
    className: panelClass(inset, stack, drop),
    "data-slot": "dialog-panel",
  };
  return (
    <ScrollArea overscrollContain scrollFade={scrollFade} contentSize={contentSize}>
      {useRender({
        defaultTagName: "div",
        props: mergeProps<"div">(defaultProps, props),
        render,
      })}
    </ScrollArea>
  );
}

export { DialogPrimitive, DialogBackdrop as DialogOverlay, DialogPopup as DialogContent };
