"use client";

import { type ComponentPropsWithRef, forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

export type TooltipIconButtonProps = Omit<ComponentPropsWithRef<typeof Button>, "className" | "style"> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
  /** Layout a Tailwind parent still owns. It sits on the wrapper, not the button. */
  className?: string;
};

function markerClass(className: string | undefined): { hooks: string; layout: string } {
  const hooks: string[] = ["aui-button-icon"];
  const layout: string[] = [];
  for (const token of (className ?? "").split(/\s+/)) {
    if (!token) continue;
    if (token.startsWith("aui-")) hooks.push(token);
    else layout.push(token);
  }
  return { hooks: hooks.join(" "), layout: layout.join(" ") };
}

// assistant-ui's icon button, on Burf's own button and tooltip (Tip): one
// tooltip layer for the whole app, and no second tooltip library.
export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  ({ children, tooltip, side = "bottom", className, variant = "ghost", size = "icon", ...rest }, ref) => {
    const { hooks, layout } = markerClass(className);
    return (
      <Tip label={tooltip} side={side}>
        <span className={cn("inline-flex size-6 shrink-0 active:scale-90", layout)}>
          <Button variant={variant} size={size} fill marker={hooks} {...rest} ref={ref}>
            {children}
            <span className="aui-sr-only sr-only">{tooltip}</span>
          </Button>
        </span>
      </Tip>
    );
  },
);

TooltipIconButton.displayName = "TooltipIconButton";
