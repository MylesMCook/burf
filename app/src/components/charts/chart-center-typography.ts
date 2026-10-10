import * as stylex from "@stylexjs/stylex";

const paint = stylex.create({
  container: {
    containerType: "inline-size",
    containerName: "chart-center",
    width: "100%",
    height: "100%",
    minWidth: 0,
  },
  value: {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: "1",
    fontSize: "clamp(0.75rem,22cqw,1.875rem)",
  },
  label: {
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: "1.25",
    fontSize: "clamp(0.625rem,9cqw,0.75rem)",
  },
});

function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export const chartCenterContainerClassName = sx(paint.container);

/** Primary stat — ~22% of center width, clamped between text-sm and text-3xl. */
export const chartCenterValueClassName = sx(paint.value);

/** Supporting label — ~9% of center width, clamped between 10px and text-xs. */
export const chartCenterLabelClassName = sx(paint.label);
