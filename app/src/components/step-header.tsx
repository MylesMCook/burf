import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// StepHeader heads one step of a flow that goes a step at a time: a back
// arrow when there is a step to go back to, the step's own title, and a line
// about it. Add a box (in its dialog and in onboarding) and onboarding's
// project step use it; Add a project draws the same arrow beside its title.
//
// In a dialog it is the dialog's header, its title the dialog's title. On a
// page (onboarding) the arrow hangs in the margin left of the column, so a
// step's title starts where every other step's does.
export function StepHeader({ title, description, onBack, variant = "dialog", className }: { title: ReactNode; description?: ReactNode; onBack?: () => void; variant?: "dialog" | "page"; className?: string }) {
  const back = onBack && (
    <Button size="icon-sm" variant="ghost" aria-label="Back" className={variant === "page" ? "absolute top-0 -left-10 text-muted-foreground" : "-ms-1.5 -mt-0.5 shrink-0"} onClick={onBack}>
      <ArrowLeftIcon />
    </Button>
  );
  if (variant === "page") {
    return (
      <header className={cn("relative", className)}>
        {back}
        <h1 className="font-semibold text-xl tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>}
      </header>
    );
  }
  return (
    <DialogHeader className={cn("flex-row items-start gap-3 px-5 pt-5 pb-3", className)}>
      {back}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <DialogTitle className="text-base">{title}</DialogTitle>
        {description && <DialogDescription className="text-[13px]">{description}</DialogDescription>}
      </div>
    </DialogHeader>
  );
}
