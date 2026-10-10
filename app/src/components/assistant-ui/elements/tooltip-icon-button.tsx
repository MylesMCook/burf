"use client";

import { type ComponentPropsWithRef, forwardRef } from "react";
import * as stylex from "@stylexjs/stylex";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import { radius } from "@/styles/tokens.stylex";


const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  wrap: {
    display: "inline-flex",
    flexShrink: 0,
    transform: { default: "scale(1)", ":active": "scale(0.9)" },
    transitionProperty: "transform",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  box5: { width: 20, height: 20 },
  box6: { width: 24, height: 24 },
  box7: { width: 28, height: 28 },
  round: {
    borderRadius: radius.full,
    transform: { default: "scale(1)", ":active": "scale(0.96)" },
  },
  remove: {
    position: "absolute",
    insetInlineEnd: 4,
    top: 4,
    "::after": {
      content: '""',
      position: "absolute",
      inset: -6,
    },
  },
  scroll: {
    position: "absolute",
    top: -48,
    zIndex: 10,
    alignSelf: "center",
    width: 32,
    height: 32,
    borderRadius: radius.full,
    visibility: { default: "visible", ":has(:disabled)": "hidden" },
  },
  submitted: {
    backgroundColor: { "[data-submitted='true']": "var(--accent)" },
    color: { "[data-submitted='true']": "var(--accent-foreground)" },
  },
  open: {
    backgroundColor: { "[data-state='open']": "var(--accent)" },
  },
  sr: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});

function cls(...parts: readonly (false | null | undefined | object)[]): string | undefined {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className;
}

export type TooltipIconButtonProps = Omit<ComponentPropsWithRef<typeof Button>, "className" | "style"> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
  /** Hook classes such as `aui-*`. */
  marker?: string;
  box?: 5 | 6 | 7;
  round?: boolean;
  place?: "remove" | "scroll";
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  ({ children, tooltip, side = "bottom", marker, box = 6, round = false, place, variant = "ghost", size = "icon", ...rest }, ref) => {
    const hooks = ["aui-button-icon", marker].filter(Boolean).join(" ");
    const state = cls(styles.submitted, styles.open);
    return (
      <Tip label={tooltip} side={side}>
        <span className={cls(styles.wrap, box === 5 && styles.box5, box === 6 && !place && styles.box6, box === 7 && styles.box7, round && styles.round, place === "remove" && styles.remove, place === "scroll" && styles.scroll)}>
          <Button variant={variant} size={size} fill marker={[hooks, state].filter(Boolean).join(" ")} look={place === "remove" ? "remove" : undefined} {...rest} ref={ref}>
            {children}
            <span className={["aui-sr-only", cls(styles.sr)].filter(Boolean).join(" ")}>{tooltip}</span>
          </Button>
        </span>
      </Tip>
    );
  },
);

TooltipIconButton.displayName = "TooltipIconButton";
