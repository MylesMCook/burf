"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { chartCenterContainerClassName, chartCenterLabelClassName, chartCenterValueClassName } from "./chart-center-typography";
import { ChartStatFlow, type ChartStatFlowFormat, defaultChartStatFlowFormat } from "./chart-stat-flow";

const paint = stylex.create({
  s0: {
    "alignItems": "flex-start",
    "textAlign": "left",
  },
  s1: {
    "alignItems": "center",
    "textAlign": "center",
  },
  s2: {
    "alignItems": "flex-end",
    "textAlign": "right",
  },
  s3: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s4: {
    "alignSelf": "flex-start",
  },
  s5: {
    "alignSelf": "center",
  },
  s6: {
    "alignSelf": "flex-end",
  },
  s7: {
    "alignItems": "flex-start",
  },
  s8: {
    "alignItems": "center",
  },
  s9: {
    "alignItems": "flex-end",
  },
  s10: {
    "justifyContent": "flex-start",
  },
  s11: {
    "justifyContent": "center",
  },
  s12: {
    "justifyContent": "flex-end",
  },
  s13: {
    "width": "100%",
    "minWidth": "0px",
  },
  s14: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "12px",
  },
  s15: {
    "width": "100%",
    "minWidth": "0px",
  },
  s16: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "12px",
  },
  s17: {
    "width": "100%",
    "minWidth": "0px",
  },
  s18: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "16px",
  },
  s19: {
    "flexShrink": 0,
  },
  s20: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s21: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "16px",
  },
  s22: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s23: {
    "flexShrink": 0,
  },
  nLabel: {
    "fontSize": "var(--chart-foreground-muted)",
  },
  nValue: {
    "fontSize": "var(--chart-foreground)",
  },

  s24: {
    alignItems: "flex-start",
    textAlign: "left",
  },
  s25: {
    alignItems: "center",
    textAlign: "center",
  },
  s26: {
    alignItems: "flex-end",
    textAlign: "right",
  },
  s27: {
    justifyContent: "flex-start",
  },
  s28: {
    justifyContent: "center",
  },
  s29: {
    justifyContent: "flex-end",
  },
  s30: {
    alignItems: "flex-start",
  },
  s31: {
    alignItems: "center",
  },
  s32: {
    alignItems: "flex-end",
  },
  s33: {
    alignSelf: "flex-start",
  },
  s34: {
    alignSelf: "center",
  },
  s35: {
    alignSelf: "flex-end",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export type GaugeLabelPlacement = "top" | "bottom" | "left" | "right";
export type GaugeLabelAlign = "start" | "center" | "end";

export interface GaugeLabelShellProps {
  centerValue: number;
  defaultLabel?: string;
  prefix?: string;
  suffix?: string;
  formatOptions?: ChartStatFlowFormat;
  align?: GaugeLabelAlign;
  className?: string;
}

const labelAlignClass: Record<GaugeLabelAlign, string> = {
  start: (sx(paint.s24) ?? ""),
  center: (sx(paint.s25) ?? ""),
  end: (sx(paint.s26) ?? ""),
};

export function GaugeLabelShell({
  centerValue,
  defaultLabel = "Total",
  prefix,
  suffix,
  formatOptions = defaultChartStatFlowFormat,
  align = "center",
  className,
}: GaugeLabelShellProps) {
  return (
    <div
      className={[chartCenterContainerClassName, sx(paint.s3), labelAlignClass[align], className].filter(Boolean).join(" ")}
    >
      <ChartStatFlow
        formatOptions={formatOptions}
        label={defaultLabel}
        labelClassName={[chartCenterLabelClassName, sx(paint.nLabel)].filter(Boolean).join(" ")}
        prefix={prefix}
        suffix={suffix}
        value={centerValue}
        valueClassName={[chartCenterValueClassName, sx(paint.nValue)].filter(Boolean).join(" ")}
      />
    </div>
  );
}

const crossAxisSelf: Record<GaugeLabelAlign, string> = {
  start: (sx(paint.s33) ?? ""),
  center: (sx(paint.s34) ?? ""),
  end: (sx(paint.s35) ?? ""),
};

const crossAxisAlign: Record<GaugeLabelAlign, string> = {
  start: (sx(paint.s30) ?? ""),
  center: (sx(paint.s31) ?? ""),
  end: (sx(paint.s32) ?? ""),
};

const inlineAxisAlign: Record<GaugeLabelAlign, string> = {
  start: (sx(paint.s27) ?? ""),
  center: (sx(paint.s28) ?? ""),
  end: (sx(paint.s29) ?? ""),
};

export function GaugeLabelLayout({
  placement,
  align,
  label,
  children,
  className,
}: {
  placement: GaugeLabelPlacement;
  align: GaugeLabelAlign;
  label: ReactNode | null;
  children: ReactNode;
  className?: string;
}) {
  if (!label) {
    return <div className={[sx(paint.s13), className].filter(Boolean).join(" ")}>{children}</div>;
  }

  if (placement === "top") {
    return (
      <div
        className={[sx(paint.s14), crossAxisAlign[align], className].filter(Boolean).join(" ")}
      >
        <div className={crossAxisSelf[align]}>{label}</div>
        <div className={sx(paint.s15)}>{children}</div>
      </div>
    );
  }

  if (placement === "bottom") {
    return (
      <div
        className={[sx(paint.s16), crossAxisAlign[align], className].filter(Boolean).join(" ")}
      >
        <div className={sx(paint.s17)}>{children}</div>
        <div className={crossAxisSelf[align]}>{label}</div>
      </div>
    );
  }

  if (placement === "left") {
    return (
      <div
        className={[sx(paint.s18), inlineAxisAlign[align], className].filter(Boolean).join(" ")}
      >
        <div className={sx(paint.s19)}>{label}</div>
        <div className={sx(paint.s20)}>{children}</div>
      </div>
    );
  }

  return (
    <div
      className={[sx(paint.s21), inlineAxisAlign[align], className].filter(Boolean).join(" ")}
    >
      <div className={sx(paint.s22)}>{children}</div>
      <div className={sx(paint.s23)}>{label}</div>
    </div>
  );
}
