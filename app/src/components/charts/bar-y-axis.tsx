"use client";

import * as stylex from "@stylexjs/stylex";
import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChart, useChartStable } from "./chart-context";

const paint = stylex.create({
  s0: {
    "position": "absolute",
    "right": "0px",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "paddingRight": "8px",
  },
  s1: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "textAlign": "right",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": "0px",
    "bottom": "0px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface BarYAxisProps {
  /** Whether to show all labels or skip some for dense data. Default: true */
  showAllLabels?: boolean;
  /** Maximum number of labels to show. Default: 20 */
  maxLabels?: number;
}

interface BarYAxisLabelProps {
  label: string;
  y: number;
  bandHeight: number;
  isHovered: boolean;
}

function BarYAxisLabel({
  label,
  y,
  bandHeight,
  isHovered,
}: BarYAxisLabelProps) {
  return (
    <div
      className={sx(paint.s0)}
      style={{
        top: y,
        height: bandHeight,
      }}
    >
      <motion.span
        animate={{
          opacity: isHovered ? 1 : 0.7,
          color: isHovered
            ? "var(--foreground)"
            : "var(--chart-label, var(--color-zinc-500))",
        }}
        className={sx(paint.s1)}
        initial={{
          opacity: 0.7,
          color: "var(--chart-label, var(--color-zinc-500))",
        }}
        // Burf: room for the longer names a margin.left makes room for.
        style={{ maxWidth: 160 }}
        transition={{ duration: 0.15 }}
      >
        {label}
      </motion.span>
    </div>
  );
}

export function BarYAxis(props: BarYAxisProps) {
  const { containerRef, barScale } = useChartStable();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }

  if (!barScale) {
    return null;
  }

  return <BarYAxisInner {...props} container={container} />;
}

const BarYAxisInner = memo(function BarYAxisInner({
  showAllLabels = true,
  maxLabels = 20,
  container,
}: BarYAxisProps & { container: HTMLDivElement }) {
  const { margin, barScale, bandWidth, barXAccessor, data, hoveredBarIndex } =
    useChart();

  // Generate labels for each bar
  const labelsToShow = useMemo(() => {
    if (!(barScale && bandWidth && barXAccessor)) {
      return [];
    }

    const allLabels = data.map((d, i) => {
      const label = barXAccessor(d);
      const bandY = barScale(label) ?? 0;
      // Center the label vertically within the band
      const y = bandY + margin.top;
      return { label, y, bandHeight: bandWidth, index: i };
    });

    // If showAllLabels is true or we have fewer than maxLabels, show all
    if (showAllLabels || allLabels.length <= maxLabels) {
      return allLabels;
    }

    // Otherwise, skip some labels to avoid crowding
    const step = Math.ceil(allLabels.length / maxLabels);
    return allLabels.filter((_, i) => i % step === 0);
  }, [
    barScale,
    bandWidth,
    barXAccessor,
    data,
    margin.top,
    showAllLabels,
    maxLabels,
  ]);

  return createPortal(
    <div
      className={sx(paint.s2)}
      style={{
        left: 0,
        width: margin.left,
      }}
    >
      {labelsToShow.map((item) => (
        <BarYAxisLabel
          bandHeight={item.bandHeight}
          isHovered={hoveredBarIndex === item.index}
          key={`${item.label}-${item.y}`}
          label={item.label}
          y={item.y}
        />
      ))}
    </div>,
    container
  );
});

BarYAxis.displayName = "BarYAxis";

export default BarYAxis;
