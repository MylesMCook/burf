"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 },
  label: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,
    fontSize: { default: 16, [sm]: 14 },
    lineHeight: { default: "18px", [sm]: "16px" },
    color: color.foreground,
  },
  dim: { opacity: 0.64 },
  item: { display: "flex" },
  description: { color: color.mutedForeground, fontSize: 12 },
  truncate: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" },
  error: { color: color.destructiveForeground, fontSize: 12 },
});

export function Field(props: Omit<FieldPrimitive.Root.Props, "className" | "style">): React.ReactElement {
  return <FieldPrimitive.Root className={stylex.props(styles.root).className} data-slot="field" {...props} />;
}

export function FieldLabel(props: Omit<FieldPrimitive.Label.Props, "className" | "style">): React.ReactElement {
  return (
    <FieldPrimitive.Label
      className={(state) => stylex.props(styles.label, state.disabled && styles.dim).className}
      data-slot="field-label"
      {...props}
    />
  );
}

export function FieldItem(props: Omit<FieldPrimitive.Item.Props, "className" | "style">): React.ReactElement {
  return <FieldPrimitive.Item className={stylex.props(styles.item).className} data-slot="field-item" {...props} />;
}

export function FieldDescription({
  truncate = false,
  ...props
}: Omit<FieldPrimitive.Description.Props, "className" | "style"> & { truncate?: boolean }): React.ReactElement {
  return <FieldPrimitive.Description className={stylex.props(styles.description, truncate && styles.truncate).className} data-slot="field-description" {...props} />;
}

export function FieldError(props: Omit<FieldPrimitive.Error.Props, "className" | "style">): React.ReactElement {
  return <FieldPrimitive.Error className={stylex.props(styles.error).className} data-slot="field-error" {...props} />;
}

export const FieldControl: typeof FieldPrimitive.Control = FieldPrimitive.Control;
export const FieldValidity: typeof FieldPrimitive.Validity = FieldPrimitive.Validity;

export { FieldPrimitive };
