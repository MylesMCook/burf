"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as stylex from "@stylexjs/stylex";
import * as React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";
const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  root: { width: "100%" },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  control: {
    display: "flex",
    touchAction: "none",
    userSelect: "none",
    opacity: { default: 1, ":disabled": 0.64 },
    pointerEvents: { default: "auto", ":disabled": "none" },
  },
  controlRow: { width: "100%", minWidth: "11rem" },
  controlColumn: { height: "100%", minHeight: "11rem", flexDirection: "column" },
  track: { position: "relative", flexGrow: 1, userSelect: "none" },
  trackRow: { height: 4, width: "100%" },
  trackColumn: { height: "100%", width: 4 },
  rail: {
    "::before": {
      content: '""',
      position: "absolute",
      borderRadius: radius.full,
      backgroundColor: color.input,
    },
  },
  railRow: { "::before": { top: 0, right: 2, bottom: 0, left: 2 } },
  railColumn: { "::before": { top: 2, right: 0, bottom: 2, left: 0 } },
  indicator: { userSelect: "none", borderRadius: radius.full, backgroundColor: color.primary },
  indicatorRow: { marginInlineStart: 2 },
  indicatorColumn: { marginBottom: 2 },
  thumb: {
    position: "relative",
    display: "block",
    flexShrink: 0,
    userSelect: "none",
    width: { default: 20, [sm]: 16 },
    height: { default: 20, [sm]: 16 },
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--slider-thumb-border)",
    backgroundColor: "white",
    backgroundClip: "padding-box",
    outline: "none",
    boxShadow: {
      default: "0 1px 2px color-mix(in oklab, black 5%, transparent)",
      ":has(:focus-visible)": "0 0 0 3px var(--slider-ring)",
    },
    scale: { default: 1, ":has(:focus-visible)": 1 },
    transitionProperty: "box-shadow, scale",
    transitionDuration: { default: "150ms", [still]: "0s" },
    "::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      borderRadius: radius.full,
      boxShadow: "0 1px color-mix(in oklab, black 4%, transparent)",
    },
  },
  dragging: { scale: 1.2, boxShadow: "none" },
  value: { display: "flex", justifyContent: "flex-end", fontSize: 14 },
});

export function Slider({
  children,
  defaultValue,
  value,
  min = 0,
  max = 100,
  grow = false,
  ...props
}: Omit<SliderPrimitive.Root.Props, "className"> & { grow?: boolean }): React.ReactElement {
  const _values = React.useMemo(() => {
    if (value !== undefined) return Array.isArray(value) ? value : [value];
    if (defaultValue !== undefined) return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    return [min];
  }, [value, defaultValue, min]);

  return (
    <SliderPrimitive.Root
      className={stylex.props(styles.root, grow && styles.grow).className}
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      {children}
      <SliderPrimitive.Control
        className={(state) => stylex.props(styles.control, state.orientation === "vertical" ? styles.controlColumn : styles.controlRow).className}
        data-slot="slider-control"
      >
        <SliderPrimitive.Track
          className={(state) =>
            stylex.props(styles.track, styles.rail, state.orientation === "vertical" ? styles.trackColumn : styles.trackRow, state.orientation === "vertical" ? styles.railColumn : styles.railRow)
              .className
          }
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className={(state) => stylex.props(styles.indicator, state.orientation === "vertical" ? styles.indicatorColumn : styles.indicatorRow).className}
            data-slot="slider-indicator"
          />
          {Array.from({ length: _values.length }, (_, index) => (
            <SliderPrimitive.Thumb
              className={(state) => stylex.props(styles.thumb, state.dragging && styles.dragging).className}
              data-slot="slider-thumb"
              index={index}
              key={String(index)}
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export function SliderValue(props: Omit<SliderPrimitive.Value.Props, "className" | "style">): React.ReactElement {
  return <SliderPrimitive.Value className={stylex.props(styles.value).className} data-slot="slider-value" {...props} />;
}

export { SliderPrimitive };
