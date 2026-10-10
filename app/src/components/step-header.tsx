import * as stylex from "@stylexjs/stylex";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const paint = stylex.create({
  s0: {
    "position": "absolute",
    "top": "0px",
    "color": "var(--muted-foreground)",
  },
  s1: {
    "marginInlineStart": "calc(6px * -1)",
    "marginTop": "calc(4px * -1)",
    "marginBottom": "calc(4px * -1)",
    "flexShrink": 0,
  },
  s2: {
    "position": "relative",
  },
  s3: {
    "fontWeight": 600,
    "fontSize": "20px",
    "lineHeight": "28px",
    "letterSpacing": "-0.025em",
  },
  s4: {
    "marginTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "1.625",
  },
  s5: {
    "display": "flex",
    "height": "24px",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s6: {
    "display": "flex",
    "minWidth": "0px",
  },

  s7: {
    left: -40,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// StepHeader heads one step of a flow that goes a step at a time: a back
// arrow when there is a step to go back to, the step's own title, and a line
// about it. Every dialog with steps uses it (Add a box, Add a project, the
// prompt picker, broadcast and its results), and onboarding's steps, so a
// back arrow looks and sits the same everywhere.
//
// In a dialog it is the dialog's header, its title the dialog's title, and
// `aside` sits on the title's line after it (the agent a prompt goes to,
// say). On a page (onboarding) the arrow hangs in the margin left of the
// column, so a step's title starts where every other step's does.
export function StepHeader({
  title,
  description,
  onBack,
  backLabel = "Back",
  aside,
  hideDescription,
  variant = "dialog",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  aside?: ReactNode;
  // For screen readers only, where the step speaks for itself.
  hideDescription?: boolean;
  variant?: "dialog" | "page";
  className?: string;
}) {
  const back = onBack && (
    <span className={variant === "page" ? [sx(paint.s0), sx(paint.s7)].filter(Boolean).join(" ") : sx(paint.s1)}><Button type="button" size="icon-sm" variant="ghost" aria-label={backLabel} data-focus-skip=""  onClick={onBack}>
      <ArrowLeftIcon />
    </Button></span>
  );
  if (variant === "page") {
    return (
      <header className={[sx(paint.s2), className].filter(Boolean).join(" ")}>
        {back}
        <h1 className={sx(paint.s3)}>{title}</h1>
        {description && <p className={sx(paint.s4)}>{description}</p>}
      </header>
    );
  }
  return (
    <DialogHeader pad="step">
      {/* One line, as tall as the arrow, whatever sits on it: the title
          stays put from step to step. */}
      <div className={sx(paint.s5)}>
        {back}
        {/* The title is short and says what this is; the aside gives way. */}
        <DialogTitle shrink={!!aside} size="line" truncate={!aside}>{title}</DialogTitle>
        {aside && <span className={sx(paint.s6)}>{aside}</span>}
      </div>
      {description && <DialogDescription hidden={hideDescription} size="13">{description}</DialogDescription>}
    </DialogHeader>
  );
}
