"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type React from "react";
import { FocusRescue } from "@/lib/focus-home";
import {
  alertFooterClass,
  alertHeaderClass,
  backdropClass,
  descriptionClass,
  popupClass,
  titleClass,
  viewportClass,
  type DialogWidth,
} from "@/components/ui/dialog-chrome";

export const AlertDialogCreateHandle: typeof AlertDialogPrimitive.createHandle = AlertDialogPrimitive.createHandle;
export const AlertDialog: typeof AlertDialogPrimitive.Root = AlertDialogPrimitive.Root;
export const AlertDialogPortal: typeof AlertDialogPrimitive.Portal = AlertDialogPrimitive.Portal;

function moving(status: string | undefined): boolean {
  return status === "starting" || status === "ending";
}

export function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props): React.ReactElement {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

export function AlertDialogBackdrop(props: Omit<AlertDialogPrimitive.Backdrop.Props, "className" | "style">): React.ReactElement {
  return (
    <AlertDialogPrimitive.Backdrop
      className={(state) => backdropClass(moving(state.transitionStatus))}
      data-slot="alert-dialog-backdrop"
      {...props}
    />
  );
}

export function AlertDialogViewport({
  bottom = false,
  ...props
}: Omit<AlertDialogPrimitive.Viewport.Props, "className" | "style"> & {
  bottom?: boolean;
}): React.ReactElement {
  return (
    <AlertDialogPrimitive.Viewport className={viewportClass(false, bottom)} data-slot="alert-dialog-viewport" {...props} />
  );
}

export function AlertDialogPopup({
  children,
  bottomStickOnMobile = true,
  portalProps,
  width = "lg",
  ...props
}: Omit<AlertDialogPrimitive.Popup.Props, "className" | "style"> & {
  bottomStickOnMobile?: boolean;
  portalProps?: AlertDialogPrimitive.Portal.Props;
  width?: DialogWidth;
}): React.ReactElement {
  return (
    <AlertDialogPortal {...portalProps}>
      <AlertDialogBackdrop />
      <AlertDialogViewport bottom={bottomStickOnMobile}>
        <AlertDialogPrimitive.Popup
          className={(state) =>
            popupClass({
              width,
              frame: "default",
              anchored: false,
              bottom: bottomStickOnMobile,
              starting: moving(state.transitionStatus),
            })
          }
          data-slot="alert-dialog-popup"
          {...props}
        >
          <FocusRescue />
          {children}
        </AlertDialogPrimitive.Popup>
      </AlertDialogViewport>
    </AlertDialogPortal>
  );
}

export function AlertDialogHeader(props: Omit<React.ComponentProps<"div">, "className" | "style">): React.ReactElement {
  return <div className={alertHeaderClass()} data-slot="alert-dialog-header" {...props} />;
}

export function AlertDialogFooter({
  variant = "default",
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & {
  variant?: "default" | "bare";
}): React.ReactElement {
  return <div className={alertFooterClass(variant)} data-slot="alert-dialog-footer" data-variant={variant} {...props} />;
}

export function AlertDialogTitle(props: Omit<AlertDialogPrimitive.Title.Props, "className" | "style">): React.ReactElement {
  return <AlertDialogPrimitive.Title className={titleClass({ size: "xl", row: false, truncate: false, shrink: false, hidden: false })} data-slot="alert-dialog-title" {...props} />;
}

export function AlertDialogDescription(props: Omit<AlertDialogPrimitive.Description.Props, "className" | "style">): React.ReactElement {
  return <AlertDialogPrimitive.Description className={descriptionClass({ size: "sm", mono: false, hidden: false, nudge: false })} data-slot="alert-dialog-description" {...props} />;
}

export function AlertDialogClose(props: AlertDialogPrimitive.Close.Props): React.ReactElement {
  return <AlertDialogPrimitive.Close data-slot="alert-dialog-close" {...props} />;
}

export { AlertDialogPrimitive, AlertDialogBackdrop as AlertDialogOverlay, AlertDialogPopup as AlertDialogContent };
