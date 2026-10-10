"use client";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import * as stylex from "@stylexjs/stylex";
import { MinusIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";
const coarse = "@media (pointer: coarse)";

const styles = stylex.create({
  root: { display: "flex", width: "100%", flexDirection: "column", alignItems: "flex-start", gap: 8 },
  w28: { width: "7rem" },
  w36: { width: "9rem" },
  group: {
    position: "relative",
    display: "flex",
    width: "100%",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: color.input,
      ":focus-within": color.ring,
      ':has([aria-invalid="true"])': "color-mix(in oklab, var(--destructive) 36%, transparent)",
      ':focus-within:has([aria-invalid="true"])': "color-mix(in oklab, var(--destructive) 64%, transparent)",
    },
    backgroundColor: "var(--control-fill)",
    color: color.foreground,
    fontSize: { default: 16, [sm]: 14 },
    boxShadow: {
      default: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
      ":focus-within": "0 0 0 3px color-mix(in oklab, var(--ring) 24%, transparent)",
      ':has([aria-invalid="true"])': "none",
      ':focus-within:has([aria-invalid="true"])': "0 0 0 3px var(--invalid-ring)",
      ":disabled": "none",
    },
    opacity: { default: 1, ":disabled": 0.64 },
    pointerEvents: { default: "auto", ":disabled": "none" },
    "::before": {
      content: '""',
      pointerEvents: "none",
      position: "absolute",
      inset: 0,
      borderRadius: "calc(var(--radius-lg) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
    ":focus-within": { "::before": { boxShadow: "none" } },
    ":not(#\\#) svg": {
      pointerEvents: "none",
      flexShrink: 0,
      width: { default: 18, [sm]: 16 },
      height: { default: 18, [sm]: 16 },
    },
  },
  step: {
    position: "relative",
    display: "flex",
    flexShrink: 0,
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 11,
    paddingRight: 11,
    backgroundColor: { ":hover": color.accent },
    "::after": {
      content: { [coarse]: '""' },
      position: { [coarse]: "absolute" },
      width: { [coarse]: "100%" },
      height: { [coarse]: "100%" },
      minWidth: { [coarse]: 44 },
      minHeight: { [coarse]: 44 },
    },
  },
  stepSm: { paddingLeft: { ":is([data-size='sm'] &)": 9 }, paddingRight: { ":is([data-size='sm'] &)": 9 } },
  dec: { borderStartStartRadius: "calc(var(--radius-lg) - 1px)", borderEndStartRadius: "calc(var(--radius-lg) - 1px)" },
  inc: { borderStartEndRadius: "calc(var(--radius-lg) - 1px)", borderEndEndRadius: "calc(var(--radius-lg) - 1px)" },
  input: {
    height: { default: 34, [sm]: 30 },
    width: "100%",
    minWidth: 0,
    flexGrow: 1,
    backgroundColor: "transparent",
    paddingLeft: 11,
    paddingRight: 11,
    textAlign: "center",
    color: color.foreground,
    fontVariantNumeric: "tabular-nums",
    lineHeight: { default: "34px", [sm]: "30px" },
    outline: "none",
  },
  inputSm: {
    height: { ":is([data-size='sm'] &)": 30, [sm]: { ":is([data-size='sm'] &)": 26 } },
  },
  scrub: { display: "flex", cursor: "ew-resize" },
  cursor: { filter: "drop-shadow(0 1px 1px #0008)" },
});

export const NumberFieldContext: React.Context<{ fieldId: string } | null> = React.createContext<{ fieldId: string } | null>(null);

export function NumberField({
  id,
  size = "default",
  measure,
  ...props
}: Omit<NumberFieldPrimitive.Root.Props, "className"> & {
  size?: "sm" | "default" | "lg";
  measure?: "28" | "36";
}): React.ReactElement {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  return (
    <NumberFieldContext.Provider value={{ fieldId }}>
      <NumberFieldPrimitive.Root
        className={stylex.props(styles.root, measure === "28" && styles.w28, measure === "36" && styles.w36).className}
        data-size={size}
        data-slot="number-field"
        id={fieldId}
        {...props}
      />
    </NumberFieldContext.Provider>
  );
}

export function NumberFieldGroup(props: Omit<NumberFieldPrimitive.Group.Props, "className" | "style">): React.ReactElement {
  return <NumberFieldPrimitive.Group className={stylex.props(styles.group).className} data-slot="number-field-group" {...props} />;
}

export function NumberFieldDecrement(props: Omit<NumberFieldPrimitive.Decrement.Props, "className" | "style">): React.ReactElement {
  return (
    <NumberFieldPrimitive.Decrement className={stylex.props(styles.step, styles.stepSm, styles.dec).className} data-slot="number-field-decrement" {...props}>
      <MinusIcon />
    </NumberFieldPrimitive.Decrement>
  );
}

export function NumberFieldIncrement(props: Omit<NumberFieldPrimitive.Increment.Props, "className" | "style">): React.ReactElement {
  return (
    <NumberFieldPrimitive.Increment className={stylex.props(styles.step, styles.stepSm, styles.inc).className} data-slot="number-field-increment" {...props}>
      <PlusIcon />
    </NumberFieldPrimitive.Increment>
  );
}

export function NumberFieldInput(props: Omit<NumberFieldPrimitive.Input.Props, "className" | "style">): React.ReactElement {
  return <NumberFieldPrimitive.Input className={stylex.props(styles.input, styles.inputSm).className} data-slot="number-field-input" {...props} />;
}

export function NumberFieldScrubArea({
  label,
  ...props
}: Omit<NumberFieldPrimitive.ScrubArea.Props, "className" | "style"> & { label: string }): React.ReactElement {
  const context = React.useContext(NumberFieldContext);
  if (!context) throw new Error("NumberFieldScrubArea must be used within a NumberField component for accessibility.");
  return (
    <NumberFieldPrimitive.ScrubArea className={stylex.props(styles.scrub).className} data-slot="number-field-scrub-area" {...props}>
      <Label drag htmlFor={context.fieldId}>
        {label}
      </Label>
      <NumberFieldPrimitive.ScrubAreaCursor className={stylex.props(styles.cursor).className}>
        <CursorGrowIcon />
      </NumberFieldPrimitive.ScrubAreaCursor>
    </NumberFieldPrimitive.ScrubArea>
  );
}

export function CursorGrowIcon(props: React.ComponentProps<"svg">): React.ReactElement {
  return (
    <svg aria-hidden="true" fill="black" height="14" stroke="white" viewBox="0 0 24 14" width="26" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
    </svg>
  );
}

export { NumberFieldPrimitive };
