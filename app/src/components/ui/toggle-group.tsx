"use client";

import type { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import * as stylex from "@stylexjs/stylex";
import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { Toggle as ToggleComponent, type ToggleSize, type ToggleVariant } from "@/components/ui/toggle";
import { color, radius } from "@/styles/tokens.stylex";

const coarse = "@media (pointer: coarse)";

const hot = ":not(#\\#) > [data-slot=separator]:has(+ [data-slot=toggle]:hover)::before";
const pressed = ":not(#\\#) > [data-slot=separator]:has(+ [data-slot=toggle][data-pressed])::before";
const hotBefore = ":not(#\\#) > [data-slot=toggle]:hover + [data-slot=separator]::before";
const pressedBefore = ":not(#\\#) > [data-slot=toggle][data-pressed] + [data-slot=separator]::before";

const styles = stylex.create({
  base: {
    display: "flex",
    width: "fit-content",
    ":not(#\\#) > :focus-visible": { zIndex: 10 },
    [hot]: { backgroundColor: "var(--separator-hot)" },
    [pressed]: { backgroundColor: "var(--separator-press)" },
    [hotBefore]: { backgroundColor: "var(--separator-hot)" },
    [pressedBefore]: { backgroundColor: "var(--separator-press)" },
  },
  row: { ":not(#\\#) > *::after": { minWidth: { [coarse]: "auto" } } },
  column: { flexDirection: "column", ":not(#\\#) > *::after": { minHeight: { [coarse]: "auto" } } },
  loose: { gap: 2 },
  joinedRow: {
    ":not(#\\#) > :not(:first-child)": { borderStartStartRadius: 0, borderEndStartRadius: 0, borderInlineStartWidth: 0 },
    ":not(#\\#) > :not(:last-child)": { borderStartEndRadius: 0, borderEndEndRadius: 0, borderInlineEndWidth: 0 },
    ":not(#\\#) > :not(:first-child)::before": { borderStartStartRadius: 0, borderEndStartRadius: 0 },
    ":not(#\\#) > :not(:last-child)::before": { borderStartEndRadius: 0, borderEndEndRadius: 0 },
    ":not(#\\#) > :not(:first-child):not([data-slot=separator])::before": { insetInlineStart: -0.5 },
    ":not(#\\#) > :not(:last-child):not([data-slot=separator])::before": { insetInlineEnd: -0.5 },
  },
  joinedColumn: {
    ":not(#\\#) > :not(:first-child)": { borderStartStartRadius: 0, borderStartEndRadius: 0, borderTopWidth: 0 },
    ":not(#\\#) > :not(:last-child)": { borderEndStartRadius: 0, borderEndEndRadius: 0, borderBottomWidth: 0 },
    ":not(#\\#) > :not(:first-child)::before": { borderStartStartRadius: 0, borderStartEndRadius: 0 },
    ":not(#\\#) > :not(:last-child)::before": { borderEndStartRadius: 0, borderEndEndRadius: 0 },
    ":not(#\\#) > :not(:first-child):not([data-slot=separator])::before": { top: -0.5 },
    ":not(#\\#) > :not(:last-child):not([data-slot=separator])::before": { bottom: -0.5 },
    ":not(#\\#) > [data-slot=toggle]:not(:last-child)::before": { display: "none" },
  },
  track: {
    maxWidth: "100%",
    flexShrink: 0,
    borderRadius: radius.lg,
    backgroundColor: color.muted,
    padding: 2,
  },
  wrap: { flexWrap: "wrap" },
  shrink: { flexShrink: 0 },
  end: { marginLeft: "auto" },
  nudge: { marginLeft: 4 },
});

export const ToggleGroupContext: React.Context<{ size: ToggleSize; variant: ToggleVariant }> = React.createContext<{
  size: ToggleSize;
  variant: ToggleVariant;
}>({ size: "default", variant: "default" });

export function ToggleGroup({
  variant = "default",
  size = "default",
  orientation = "horizontal",
  track = false,
  wrap = false,
  shrink = false,
  align,
  nudge = false,
  children,
  ...props
}: Omit<ToggleGroupPrimitive.Props, "className"> & {
  variant?: ToggleVariant;
  size?: ToggleSize;
  track?: boolean;
  wrap?: boolean;
  shrink?: boolean;
  align?: "end";
  nudge?: boolean;
}): React.ReactElement {
  const joined = variant !== "default";
  const vertical = orientation === "vertical";
  return (
    <ToggleGroupPrimitive
      className={stylex.props(
        styles.base,
        vertical ? styles.column : styles.row,
        joined ? (vertical ? styles.joinedColumn : styles.joinedRow) : styles.loose,
        track && styles.track,
        wrap && styles.wrap,
        shrink && styles.shrink,
        align === "end" && styles.end,
        nudge && styles.nudge,
      ).className}
      data-size={size}
      data-slot="toggle-group"
      data-variant={variant}
      orientation={orientation}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ size, variant }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

export function ToggleGroupItem({
  children,
  variant,
  size,
  tone,
  ...props
}: Omit<TogglePrimitive.Props, "className" | "style"> & {
  variant?: ToggleVariant | null;
  size?: ToggleSize | null;
  tone?: "choice" | "warning";
}): React.ReactElement {
  const context = React.useContext(ToggleGroupContext);
  const resolvedVariant = context.variant || variant;
  const resolvedSize = context.size || size;
  return (
    <ToggleComponent data-size={resolvedSize} data-variant={resolvedVariant} size={resolvedSize} variant={resolvedVariant} tone={tone} {...props}>
      {children}
    </ToggleComponent>
  );
}

export function ToggleGroupSeparator({
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>): React.ReactElement {
  return <Separator orientation={orientation} shift tone="input" {...props} />;
}

export { ToggleGroupPrimitive };
