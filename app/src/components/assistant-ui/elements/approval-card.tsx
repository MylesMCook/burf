"use client";

import * as stylex from "@stylexjs/stylex";
import { useId, type ComponentProps, type ReactNode } from "react";
import { CheckIcon, Loader2Icon, TerminalIcon, XIcon } from "lucide-react";
import { fadeIn, field, ghostButton, inkButton, mono, paper, spin } from "./surfaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "14px",
    "borderRadius": "20px",
    "padding": "16px",
    "maxWidth": "384px",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s2: {
    "display": "flex",
    "width": "36px",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-xl)",
  },
  s3: {
    "backgroundColor": "light-dark(color-mix(in oklab, var(--color-red-600) 10%, transparent), color-mix(in oklab, var(--color-red-400) 10%, transparent))",
    "color": "light-dark(var(--color-red-600), var(--color-red-400))",
  },
  s4: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 5%, transparent)",
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
  },
  s5: {
    "width": "16px",
    "height": "16px",
  },
  s6: {
    "display": "flex",
    "flexDirection": "column",
  },
  s7: {
    "fontSize": "13.5px",
    "fontWeight": 500,
  },
  s8: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "color": "color-mix(in oklab, var(--foreground) 60%, transparent)",
    "fontSize": "13px",
  },
  s10: {
    "color": "color-mix(in oklab, var(--foreground) 70%, transparent)",
    "borderRadius": "var(--radius-xl)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "borderRadius": "var(--radius-xl)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s12: {
    "display": "grid",
    "gridTemplateColumns": "minmax(0,1fr) minmax(0,2fr)",
    "gap": "16px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "color": "color-mix(in oklab, var(--foreground) 40%, transparent)",
  },
  s14: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "overflowWrap": "break-word",
  },
  s15: {
    "display": "flex",
    "minHeight": "32px",
    "flexWrap": "wrap",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "8px",
  },
  s16: {
    "height": "32px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "whiteSpace": "nowrap",
  },
  s17: {
    "height": "32px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "whiteSpace": "nowrap",
  },
  s18: {
    "color": "light-dark(var(--background), var(--color-red-950))",
    "backgroundColor": {
      "default": "light-dark(var(--color-red-600), var(--color-red-400))",
      ":hover": "light-dark(color-mix(in oklab, var(--color-red-600) 90%, transparent), color-mix(in oklab, var(--color-red-400) 90%, transparent))",
    },
  },
  s23: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "borderRadius": "999px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "whiteSpace": "nowrap",
    "transform": {
      ":active": "scale(0.96)",
    },
    "transitionProperty": "background-color, scale",
    "transitionDuration": {
      "default": "150ms",
      "@media (prefers-reduced-motion: reduce)": "0s",
    },
  },
  s19: {
    "color": "color-mix(in oklab, var(--foreground) 55%, transparent)",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "transitionDuration": "300ms",
  },
  s20: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "width": "14px",
    "height": "14px",
  },
  s21: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "width": "14px",
    "height": "14px",
  },
  s22: {
    "width": "14px",
    "height": "14px",
    "color": "#10b981",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export type ApprovalState = "request" | "running" | "done" | "denied";

const receiptText: Record<Exclude<ApprovalState, "request">, string> = {
  running: "Approved, running",
  done: "Finished",
  denied: "Denied",
};

export function ApprovalCard({
  state,
  command,
  title,
  subtitle,
  description,
  details,
  variant = "default",
  icon,
  onAllowOnce,
  onAlwaysAllow,
  onDeny,
  allowOnceLabel = "Allow once",
  alwaysAllowLabel = "Always allow",
  denyLabel = "Deny",
  statusLabel,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  | "children"
  | "state"
  | "command"
  | "title"
  | "subtitle"
  | "description"
  | "details"
  | "variant"
  | "icon"
  | "onAllowOnce"
  | "onAlwaysAllow"
  | "onDeny"
  | "allowOnceLabel"
  | "alwaysAllowLabel"
  | "denyLabel"
  | "statusLabel"
> & {
  state: ApprovalState;
  command?: string | undefined;
  title: string;
  subtitle: string;
  description?: string | undefined;
  details?: readonly { label: string; value: string }[] | undefined;
  variant?: "default" | "destructive" | undefined;
  icon?: ReactNode | undefined;
  onAllowOnce?: (() => void) | undefined;
  onAlwaysAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
  allowOnceLabel?: string | undefined;
  alwaysAllowLabel?: string | undefined;
  denyLabel?: string | undefined;
  statusLabel?: string | undefined;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div
      {...props}
      role="group"
      data-variant={variant}
      data-slot="approval-card"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={[sx(paper, paint.s0), className].filter(Boolean).join(" ")}
    >
      <div className={sx(paint.s1)}>
        <span
          aria-hidden
          className={sx(paint.s2, variant === "destructive" ? paint.s3 : paint.s4)}
        >
          {icon ?? <TerminalIcon className={sx(paint.s5)} />}
        </span>
        <div className={sx(paint.s6)}>
          <p id={titleId} className={sx(paint.s7)}>
            {title}
          </p>
          <p className={sx(paint.s8)}>{subtitle}</p>
        </div>
      </div>

      {description ? (
        <p id={descriptionId} className={sx(paint.s9)}>
          {description}
        </p>
      ) : null}

      {command ? (
        <div
          className={sx(field, paint.s10)}
        >
          {command}
        </div>
      ) : null}

      {details?.length ? (
        <dl
          className={sx(field, paint.s11)}
        >
          {details.map((detail, index) => (
            <div
              key={`${detail.label}-${index}`}
              className={sx(paint.s12)}
            >
              <dt className={sx(mono, paint.s13)}>{detail.label}</dt>
              <dd className={sx(paint.s14)}>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className={sx(paint.s15)}>
        {state === "request" ? (
          <>
            {onDeny && (
              <button
                type="button"
                onClick={onDeny}
                className={sx(ghostButton, paint.s16)}
              >
                {denyLabel}
              </button>
            )}
            {onAlwaysAllow && (
              <button
                type="button"
                onClick={onAlwaysAllow}
                className={sx(ghostButton, paint.s17)}
              >
                {alwaysAllowLabel}
              </button>
            )}
            {onAllowOnce && (
              <button
                type="button"
                onClick={onAllowOnce}
                className={sx(variant === "destructive" ? paint.s18 : inkButton, paint.s23)}
              >
                {allowOnceLabel}
              </button>
            )}
          </>
        ) : (
          <div
            key={state}
            role="status"
            className={sx(paint.s19, fadeIn)}
          >
            {state === "running" ? (
              <>
                <Loader2Icon className={sx(paint.s20, spin)} />
                {statusLabel ?? receiptText.running}
              </>
            ) : state === "denied" ? (
              <>
                <XIcon className={sx(paint.s21)} />
                {statusLabel ?? receiptText.denied}
              </>
            ) : (
              <>
                <CheckIcon className={sx(paint.s22)} />
                {statusLabel ?? receiptText.done}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
