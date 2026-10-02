import type { ReactElement, ReactNode } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";

// Tip gives an element a tooltip: the app's own, not the browser's title,
// so it appears on hover and on keyboard focus alike. The element is the
// trigger itself, so it keeps its own props and ref. No label, no tooltip.
export function Tip({ label, side, align, className, children }: { label: ReactNode; side?: "top" | "bottom" | "left" | "right"; align?: "start" | "center" | "end"; className?: string; children: ReactElement }) {
  if (label == null || label === false || label === "") return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup side={side} align={align} className={className}>
        {label}
      </TooltipPopup>
    </Tooltip>
  );
}
