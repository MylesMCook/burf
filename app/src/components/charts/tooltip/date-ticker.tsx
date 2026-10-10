"use client";

import * as stylex from "@stylexjs/stylex";
import { motion, useSpring } from "motion/react";
import { memo, useMemo, useRef } from "react";

const paint = stylex.create({
  s0: {
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": {
      "default": "light-dark(#18181b, #f4f4f5)",
    },
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": {
      "default": "light-dark(#fff, #18181b)",
    },
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s1: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s2: {
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": {
      "default": "light-dark(#18181b, #f4f4f5)",
    },
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": {
      "default": "light-dark(#fff, #18181b)",
    },
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s4: {
    "position": "relative",
    "height": "24px",
    "overflow": "hidden",
  },
  s5: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
  },
  s6: {
    "position": "relative",
    "height": "24px",
    "overflow": "hidden",
  },
  s7: {
    "display": "flex",
    "flexDirection": "column",
  },
  s8: {
    "display": "flex",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s9: {
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s10: {
    "position": "relative",
    "height": "24px",
    "overflow": "hidden",
  },
  s11: {
    "display": "flex",
    "flexDirection": "column",
  },
  s12: {
    "display": "flex",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s13: {
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const TICKER_ITEM_HEIGHT = 24;
/** Full scroll stacks are skipped above this count — single label + instant updates. */
const COMPACT_TICKER_THRESHOLD = 60;

export interface DateTickerProps {
  currentIndex: number;
  labels: string[];
  visible: boolean;
}

const DateTickerCompact = memo(function DateTickerCompact({
  currentIndex,
  labels,
}: Omit<DateTickerProps, "visible">) {
  const label = labels[currentIndex] ?? labels[0] ?? "";

  return (
    <div className={sx(paint.s0)}>
      <div className={sx(paint.s1)}>
        <span className={sx(paint.s2)}>{label}</span>
      </div>
    </div>
  );
});

const DateTickerInner = memo(function DateTickerInner({
  currentIndex,
  labels,
}: Omit<DateTickerProps, "visible">) {
  // Parse labels into month and day parts
  const parsedLabels = useMemo(() => {
    return labels.map((label, index) => {
      const parts = label.split(" ");
      const month = parts[0] || "";
      const day = parts[1] || "";
      return { month, day, full: label, key: `${label}::${index}` };
    });
  }, [labels]);

  // Month segments: one entry per consecutive run (Jan → Feb → …), keyed by start index
  const monthSegments = useMemo(() => {
    const segments: { month: string; key: string; startIndex: number }[] = [];

    parsedLabels.forEach((label, index) => {
      const prev = segments.at(-1);
      if (!prev || prev.month !== label.month) {
        segments.push({
          month: label.month,
          key: `${label.month}-${index}`,
          startIndex: index,
        });
      }
    });

    return segments;
  }, [parsedLabels]);

  // Index into monthSegments for the current data point
  const currentMonthIndex = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= parsedLabels.length) {
      return 0;
    }
    for (let i = monthSegments.length - 1; i >= 0; i--) {
      const segment = monthSegments[i];
      if (segment && segment.startIndex <= currentIndex) {
        return i;
      }
    }
    return 0;
  }, [currentIndex, parsedLabels.length, monthSegments]);

  // Track previous month index
  const prevMonthIndexRef = useRef(-1);

  // Animated Y offsets
  const dayY = useSpring(0, { stiffness: 400, damping: 35 });
  const monthY = useSpring(0, { stiffness: 400, damping: 35 });

  dayY.set(-currentIndex * TICKER_ITEM_HEIGHT);

  if (currentMonthIndex >= 0) {
    const isFirstRender = prevMonthIndexRef.current === -1;
    const monthChanged = prevMonthIndexRef.current !== currentMonthIndex;
    if (isFirstRender || monthChanged) {
      monthY.set(-currentMonthIndex * TICKER_ITEM_HEIGHT);
      prevMonthIndexRef.current = currentMonthIndex;
    }
  }

  return (
    <div className={sx(paint.s3)}>
      <div className={sx(paint.s4)}>
        <div className={sx(paint.s5)}>
          {/* Month stack */}
          <div className={sx(paint.s6)}>
            <motion.div className={sx(paint.s7)} style={{ y: monthY }}>
              {monthSegments.map((segment) => (
                <div
                  className={sx(paint.s8)}
                  key={segment.key}
                >
                  <span className={sx(paint.s9)}>
                    {segment.month}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Day stack */}
          <div className={sx(paint.s10)}>
            <motion.div className={sx(paint.s11)} style={{ y: dayY }}>
              {parsedLabels.map((label) => (
                <div
                  className={sx(paint.s12)}
                  key={label.key}
                >
                  <span className={sx(paint.s13)}>
                    {label.day}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
});

export function DateTicker({ currentIndex, labels, visible }: DateTickerProps) {
  if (!visible || labels.length === 0) {
    return null;
  }

  if (labels.length > COMPACT_TICKER_THRESHOLD) {
    return <DateTickerCompact currentIndex={currentIndex} labels={labels} />;
  }

  return <DateTickerInner currentIndex={currentIndex} labels={labels} />;
}

DateTicker.displayName = "DateTicker";

export default DateTicker;
