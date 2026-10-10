import * as stylex from "@stylexjs/stylex";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--muted) 40%, transparent), color-mix(in oklab, var(--input) 16%, transparent))",
    },
    "paddingInlineStart": "12px",
    "paddingInlineEnd": "4px",
  },
  s1: {
    "userSelect": "none",
    "fontFamily": "var(--font-mono)",
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s2: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "userSelect": "all",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "13px",
  },
  s3: {
    "flexShrink": 0,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The one line that installs berthd on a box (site/install.sh, served at
// berthd.app/install): it installs for the user who runs it, starts the
// service, and prints a pairing link.
export const INSTALL_COMMAND = "curl -fsSL https://raw.githubusercontent.com/MylesMCook/burf/main/site/install.sh | sh";

// InstallCommand shows the line to run on the box, with a copy button.
export function InstallCommand({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!navigator.clipboard) {
      toastManager.add({ type: "error", title: "Could not copy", description: "Select the line and copy it instead." });
      return;
    }
    navigator.clipboard.writeText(INSTALL_COMMAND).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => toastManager.add({ type: "error", title: "Could not copy", description: "Select the line and copy it instead." }),
    );
  };
  return (
    <div className={[sx(paint.s0), className].filter(Boolean).join(" ")}>
      <span aria-hidden className={sx(paint.s1)}>
        $
      </span>
      <code className={sx(paint.s2)}>{INSTALL_COMMAND}</code>
      <span className={sx(paint.s3)}><Button type="button" size="xs" variant="ghost"  onClick={copy} aria-label="Copy the install command" muted>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </Button></span>
    </div>
  );
}
