"use client";

import * as stylex from "@stylexjs/stylex";
import NumberFlow from "@number-flow/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

const paint = stylex.create({
  s0: {
    "marginBottom": "8px",
    "display": "flex",
    "height": "48px",
    "width": "48px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
  },
  s1: {
    "color": "var(--foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s2: {
    "marginTop": "2px",
  },

  s3: {
    color: "var(--chart-label)",
  },
  s4: {
    fontSize: 24,
    lineHeight: "32px",
    fontWeight: 700,
  },
  s5: {
    fontSize: 12,
    lineHeight: "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

/** Subset of `Intl.NumberFormatOptions` supported by NumberFlow */
export interface ChartStatFlowFormat {
  notation?: "standard" | "compact";
  compactDisplay?: "short" | "long";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
  minimumSignificantDigits?: number;
  maximumSignificantDigits?: number;
  style?: "decimal" | "percent" | "currency";
  currency?: string;
  currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  unit?: string;
  unitDisplay?: "short" | "long" | "narrow";
}

export const defaultChartStatFlowFormat: ChartStatFlowFormat = {
  notation: "standard",
  maximumFractionDigits: 0,
};

function formatStatValue(
  value: number,
  formatOptions: ChartStatFlowFormat,
  prefix?: string,
  suffix?: string
): string {
  const formatted = new Intl.NumberFormat(undefined, formatOptions).format(
    value
  );
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

function useNumberFlowElementReady(): boolean {
  const [ready, setReady] = useState(
    () =>
      typeof customElements !== "undefined" &&
      Boolean(customElements.get("number-flow-react"))
  );

  useEffect(() => {
    if (ready) {
      return;
    }
    let cancelled = false;
    customElements.whenDefined("number-flow-react").then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}

export interface ChartStatFlowProps {
  value: number;
  label: string;
  formatOptions?: ChartStatFlowFormat;
  prefix?: string;
  suffix?: string;
  valueClassName?: string;
  labelClassName?: string;
  icon?: ReactNode;
}

/**
 * Shared value + label stack using NumberFlow (same layout as pie / ring centers).
 * Parent should provide flex alignment and sizing when needed.
 */
export function ChartStatFlow({
  value,
  label,
  formatOptions = defaultChartStatFlowFormat,
  prefix,
  suffix,
  valueClassName = (sx(paint.s4) ?? ""),
  labelClassName = (sx(paint.s5) ?? ""),
  icon,
}: ChartStatFlowProps) {
  const numberFlowReady = useNumberFlowElementReady();
  const staticValue = useMemo(
    () => formatStatValue(value, formatOptions, prefix, suffix),
    [value, formatOptions, prefix, suffix]
  );

  return (
    <>
      {icon ? (
        <div className={sx(paint.s0)}>
          {icon}
        </div>
      ) : null}
      <span className={[sx(paint.s1), valueClassName].filter(Boolean).join(" ")}>
        {numberFlowReady ? (
          <NumberFlow
            format={formatOptions}
            isolate
            prefix={prefix}
            suffix={suffix}
            value={value}
            willChange
          />
        ) : (
          staticValue
        )}
      </span>
      <span className={[[sx(paint.s2), sx(paint.s3)].filter(Boolean).join(" "), labelClassName].filter(Boolean).join(" ")}>
        {label}
      </span>
    </>
  );
}

ChartStatFlow.displayName = "ChartStatFlow";
