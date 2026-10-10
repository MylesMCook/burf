"use client";

import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { CheckIcon, ChevronRightIcon, Loader2Icon, XIcon } from "lucide-react";
import { fadeIn, mono, paper, riseIn, spin } from "./surfaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "textAlign": "start",
  },
  s1: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 3%, transparent)",
    },
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s2: {
    "color": "color-mix(in oklab, var(--foreground) 25%, transparent)",
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "transitionProperty": "transform",
    "transitionDuration": "200ms",
  },
  s3: {
    "transform": "rotate(90deg)",
  },
  s4: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13.5px",
  },
  s5: {
    "color": "color-mix(in oklab, var(--foreground) 30%, transparent)",
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s6: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s7: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "#ef4444",
  },
  s8: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "#10b981",
  },
  s9: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "overflow": "hidden",
    "borderRadius": "var(--radius-2xl)",
    "maxWidth": "384px",
  },
  s10: {
    "borderColor": "color-mix(in oklab, var(--foreground) 6%, transparent)",
    "display": "flex",
    "flexDirection": "column",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "transitionDuration": "200ms",
  },
  s11: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s12: {
    "display": "flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s13: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "width": "12px",
    "height": "12px",
  },
  s14: {
    "width": "12px",
    "height": "12px",
    "color": "#ef4444",
  },
  s15: {
    "width": "12px",
    "height": "12px",
    "color": "#10b981",
  },
  s16: {
    "color": "color-mix(in oklab, var(--foreground) 55%, transparent)",
    "flexShrink": 0,
  },
  s17: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13px",
  },
  s18: {
    "color": "color-mix(in oklab, var(--foreground) 25%, transparent)",
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export type GroupedToolState = "running" | "done" | "failed";

export interface GroupedTool {
  id: string;
  name: string;
  target: string;
  state: GroupedToolState;
  durationMs?: number;
}

export function ToolGroup({
  label,
  tools,
  open,
  onOpenChange,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "label" | "tools" | "open" | "onOpenChange"
> & {
  label: string;
  tools: readonly GroupedTool[];
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const running = tools.filter((tool) => tool.state === "running").length;
  const failed = tools.filter((tool) => tool.state === "failed").length;
  const headerClassName = sx(paint.s0, Boolean(onOpenChange) && paint.s1);
  const header = (
    <>
      <ChevronRightIcon
        className={[sx(paint.s2), open && sx(paint.s3)].filter(Boolean).join(" ")}
      />
      <span className={sx(paint.s4)}>{label}</span>
      <span className={sx(mono, paint.s5)}>
        {running > 0
          ? `${tools.length - running}/${tools.length}`
          : failed > 0
            ? `${failed} failed`
            : `${tools.length} done`}
      </span>
      {running > 0 ? (
        <Loader2Icon className={sx(paint.s6, spin)} />
      ) : failed > 0 ? (
        <XIcon className={sx(paint.s7)} />
      ) : (
        <CheckIcon className={sx(paint.s8)} />
      )}
    </>
  );

  return (
    <div
      data-slot="tool-group"
      className={[sx(paper, paint.s9), className].filter(Boolean).join(" ")}

      {...props}
    >
      {onOpenChange ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className={headerClassName}
        >
          {header}
        </button>
      ) : (
        <div className={headerClassName}>{header}</div>
      )}

      {open && (
        <div className={sx(paint.s10, fadeIn, riseIn)}>
          {tools.map((tool) => (
            <div
              key={tool.id}
              className={sx(paint.s11)}
            >
              <span className={sx(paint.s12)}>
                {tool.state === "running" ? (
                  <Loader2Icon className={sx(paint.s13, spin)} />
                ) : tool.state === "failed" ? (
                  <XIcon className={sx(paint.s14)} />
                ) : (
                  <CheckIcon className={sx(paint.s15)} />
                )}
              </span>
              <span className={sx(mono, paint.s16)}>
                {tool.name}
              </span>
              <span className={sx(paint.s17)}>
                {tool.target}
              </span>
              {tool.durationMs !== undefined && (
                <span
                  className={sx(mono, paint.s18)}
                >
                  {tool.durationMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
