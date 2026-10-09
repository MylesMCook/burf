"use client";

import { type ComponentPropsWithRef, forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

// assistant-ui's icon button, on Burf's own button and tooltip (Tip): one
// tooltip layer for the whole app, and no second tooltip library.
export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
  return (
    <Tip label={tooltip} side={side}>
      <Button
        variant="ghost"
        size="icon"
        {...rest}
        className={cn("aui-button-icon size-6 p-1 active:scale-90", className)}
        ref={ref}
      >
        {children}
        <span className="aui-sr-only sr-only">{tooltip}</span>
      </Button>
    </Tip>
  );
});

TooltipIconButton.displayName = "TooltipIconButton";
