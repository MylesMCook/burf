"use client";

import * as stylex from "@stylexjs/stylex";
import { useId, useState, type ComponentProps } from "react";
import { CheckIcon, CopyIcon, Loader2Icon, XIcon } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { fadeIn, ghostButton, mono, paper, pulse, spin } from "./surfaces";
import { clamp, take } from "../utils/range";

const paint = stylex.create({
  s0: {
    "color": "color-mix(in oklab, var(--foreground) 70%, transparent)",
  },
  s1: {
    "color": {
      "default": "light-dark(var(--color-red-600), var(--color-red-400))",
    },
  },
  s2: {
    "color": {
      "default": "light-dark(var(--color-emerald-600), var(--color-emerald-400))",
    },
  },
  s3: {
    "color": {
      "default": "light-dark(var(--color-amber-600), var(--color-amber-400))",
    },
  },
  s4: {
    "color": {
      "default": "light-dark(var(--color-blue-600), var(--color-blue-400))",
    },
  },
  s5: {
    "color": {
      "default": "light-dark(var(--color-fuchsia-600), var(--color-fuchsia-400))",
    },
  },
  s6: {
    "color": {
      "default": "light-dark(var(--color-cyan-600), var(--color-cyan-400))",
    },
  },
  s7: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  s8: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
  },
  s9: {
    "color": {
      "default": "light-dark(#ef4444, #f87171)",
    },
  },
  s10: {
    "color": {
      "default": "light-dark(#10b981, #34d399)",
    },
  },
  s11: {
    "color": {
      "default": "light-dark(var(--color-amber-500), var(--color-amber-400))",
    },
  },
  s12: {
    "color": {
      "default": "light-dark(#3b82f6, #60a5fa)",
    },
  },
  s13: {
    "color": {
      "default": "light-dark(var(--color-fuchsia-500), var(--color-fuchsia-400))",
    },
  },
  s14: {
    "color": {
      "default": "light-dark(var(--color-cyan-500), var(--color-cyan-400))",
    },
  },
  s15: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  s16: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 70%, transparent), color-mix(in oklab, var(--foreground) 70%, transparent))",
    },
  },
  s17: {
    "color": {
      "default": "#f87171",
    },
  },
  s18: {
    "color": {
      "default": "#34d399",
    },
  },
  s19: {
    "color": {
      "default": "#fcd34d",
    },
  },
  s20: {
    "color": {
      "default": "#60a5fa",
    },
  },
  s21: {
    "color": {
      "default": "#e879f9",
    },
  },
  s22: {
    "color": {
      "default": "#67e8f3",
    },
  },
  s23: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 90%, transparent), color-mix(in oklab, var(--foreground) 90%, transparent))",
    },
  },
  s24: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 50%, transparent), color-mix(in oklab, var(--foreground) 50%, transparent))",
    },
  },
  s25: {
    "color": {
      "default": "#f87171",
    },
  },
  s26: {
    "color": {
      "default": "#34d399",
    },
  },
  s27: {
    "color": {
      "default": "#fcd34d",
    },
  },
  s28: {
    "color": {
      "default": "#60a5fa",
    },
  },
  s29: {
    "color": {
      "default": "#e879f9",
    },
  },
  s30: {
    "color": {
      "default": "#67e8f3",
    },
  },
  s31: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 90%, transparent), color-mix(in oklab, var(--foreground) 90%, transparent))",
    },
  },
  s32: {
    "backgroundColor": {
      "default": "light-dark(var(--foreground), var(--popover))",
    },
  },
  s33: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "6px",
  },
  s34: {
    "minWidth": "0px",
    "wordBreak": "break-all",
  },
  s35: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 90%, transparent), color-mix(in oklab, var(--foreground) 90%, transparent))",
    },
  },
  s36: {
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  s37: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 40%, transparent), color-mix(in oklab, var(--foreground) 40%, transparent))",
    },
  },
  s38: {
    "color": "color-mix(in oklab, var(--foreground) 40%, transparent)",
  },
  s39: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s40: {
    "width": "12px",
    "height": "12px",
    "color": {
      "default": "light-dark(var(--color-red-600), var(--color-red-400))",
    },
  },
  s41: {
    "width": "12px",
    "height": "12px",
    "color": "#10b981",
  },
  s42: {
    "color": {
      "default": "light-dark(var(--color-red-600), var(--color-red-400))",
    },
  },
  s43: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 40%, transparent), color-mix(in oklab, var(--foreground) 40%, transparent))",
    },
  },
  s44: {
    "color": "color-mix(in oklab, var(--foreground) 40%, transparent)",
  },
  s45: {
    "width": "24px",
    "height": "24px",
  },
  s46: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 45%, transparent), color-mix(in oklab, var(--foreground) 45%, transparent))",
      ":hover": "light-dark(var(--background), var(--foreground))",
    },
  },
  s47: {
    "width": "14px",
    "height": "14px",
    "color": "#10b981",
  },
  s48: {
    "width": "14px",
    "height": "14px",
  },
  s49: {
    "width": "12px",
    "height": "12px",
  },
  s50: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 35%, transparent), color-mix(in oklab, var(--foreground) 35%, transparent))",
    },
  },
  s51: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
  },
  s52: {
    "display": "flex",
    "minHeight": "8.5rem",
    "flexDirection": "column",
    "gap": "4px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "14px",
  },
  s53: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 55%, transparent), color-mix(in oklab, var(--foreground) 50%, transparent))",
    },
  },
  s54: {
    "color": "color-mix(in oklab, var(--foreground) 50%, transparent)",
  },
  s55: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
  },
  s56: {
    "overflowWrap": "break-word",
    "whiteSpace": "pre-wrap",
    "transitionDuration": "300ms",
  },
  s57: {
    "color": {
      "default": "light-dark(var(--color-red-600), var(--color-red-400))",
    },
  },
  s58: {
    "fontWeight": 700,
  },
  s59: {
    "opacity": 0.6,
  },
  s60: {
    "height": "28px",
    "alignSelf": "flex-start",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s61: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 45%, transparent), color-mix(in oklab, var(--foreground) 45%, transparent))",
      ":hover": "light-dark(var(--background), var(--foreground))",
    },
  },
  s62: {
    "color": {
      "default": "light-dark(color-mix(in oklab, var(--background) 35%, transparent), color-mix(in oklab, var(--foreground) 35%, transparent))",
    },
  },
  s63: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
  },
  s64: {
    "display": "inline-block",
    "height": "12px",
    "width": "6px",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, #3b82f6 70%, transparent), color-mix(in oklab, #60a5fa 70%, transparent))",
    },
  },
  s65: {
    "width": "100%",
    "maxWidth": "448px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-2xl)",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export type AnsiColor =
  | 30
  | 31
  | 32
  | 33
  | 34
  | 35
  | 36
  | 37
  | 90
  | 91
  | 92
  | 93
  | 94
  | 95
  | 96
  | 97;

export type AnsiSegment = {
  text: string;
  color?: AnsiColor | undefined;
  bold: boolean;
  dim: boolean;
};

const ANSI_COLORS = new Set<AnsiColor>([
  30, 31, 32, 33, 34, 35, 36, 37, 90, 91, 92, 93, 94, 95, 96, 97,
]);

const findCsiEnd = (line: string, start: number) => {
  for (let index = start; index < line.length; index += 1) {
    const code = line.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) return index;
  }
  return line.length;
};

const findStringEnd = (line: string, start: number, bell: boolean) => {
  for (let index = start; index < line.length; index += 1) {
    if (bell && line[index] === "\u0007") return index + 1;
    if (line[index] === "\u001b" && line[index + 1] === "\\") {
      return index + 2;
    }
  }
  return line.length;
};

const applySgr = (value: string, state: Omit<AnsiSegment, "text">) => {
  const parts = value.split(";");
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const code = part === "" ? 0 : Number(part);
    if (code === 38 || code === 48) {
      index += parts[index + 1] === "2" ? 4 : parts[index + 1] === "5" ? 2 : 1;
    } else if (code === 0) {
      state.color = undefined;
      state.bold = false;
      state.dim = false;
    } else if (code === 1) {
      state.bold = true;
    } else if (code === 2) {
      state.dim = true;
    } else if (code === 22) {
      state.bold = false;
      state.dim = false;
    } else if (code === 39) {
      state.color = undefined;
    } else if (ANSI_COLORS.has(code as AnsiColor)) {
      state.color = code as AnsiColor;
    }
  }
};

export function parseAnsi(line: string): AnsiSegment[] {
  const state: Omit<AnsiSegment, "text"> = {
    color: undefined,
    bold: false,
    dim: false,
  };
  const segments: AnsiSegment[] = [];
  let index = 0;

  const append = (text: string) => {
    if (text === "") return;
    const previous = segments[segments.length - 1];
    if (
      previous &&
      previous.color === state.color &&
      previous.bold === state.bold &&
      previous.dim === state.dim
    ) {
      previous.text += text;
      return;
    }
    segments.push({ text, ...state });
  };

  while (index < line.length) {
    const escape = line.indexOf("\u001b", index);
    const c1Offset = line.slice(index).search(/[\u009b\u009d]/);
    const c1 = c1Offset === -1 ? -1 : index + c1Offset;
    const next = escape === -1 ? c1 : c1 === -1 ? escape : Math.min(escape, c1);

    if (next === -1) {
      append(line.slice(index));
      break;
    }

    append(line.slice(index, next));
    const csi = line[next] === "\u009b" || line[next + 1] === "[";
    const osc = line[next] === "\u009d" || line[next + 1] === "]";

    if (csi) {
      const start = next + (line[next] === "\u001b" ? 2 : 1);
      const end = findCsiEnd(line, start);
      if (end === line.length) break;
      if (line[end] === "m") applySgr(line.slice(start, end), state);
      index = end + 1;
    } else if (osc) {
      index = findStringEnd(
        line,
        next + (line[next] === "\u001b" ? 2 : 1),
        true,
      );
    } else if (
      line[next] === "\u001b" &&
      ["P", "^", "_"].includes(line[next + 1] ?? "")
    ) {
      index = findStringEnd(line, next + 2, false);
    } else {
      index =
        line[next] === "\u001b" &&
        ["(", ")", "*", "+", "-", ".", "/"].includes(line[next + 1] ?? "")
          ? next + 3
          : next + 2;
    }
  }

  return segments;
}

const ansiColor = (color: AnsiColor, ink: boolean) => {
  const paperColors = {
    30: paint.s0,
    31: paint.s1,
    32: paint.s2,
    33: paint.s3,
    34: paint.s4,
    35: paint.s5,
    36: paint.s6,
    37: paint.s7,
    90: paint.s8,
    91: paint.s9,
    92: paint.s10,
    93: paint.s11,
    94: paint.s12,
    95: paint.s13,
    96: paint.s14,
    97: paint.s15,
  } satisfies Record<AnsiColor, object>;
  const inkColors = {
    30: paint.s16,
    31: paint.s17,
    32: paint.s18,
    33: paint.s19,
    34: paint.s20,
    35: paint.s21,
    36: paint.s22,
    37: paint.s23,
    90: paint.s24,
    91: paint.s25,
    92: paint.s26,
    93: paint.s27,
    94: paint.s28,
    95: paint.s29,
    96: paint.s30,
    97: paint.s31,
  } satisfies Record<AnsiColor, object>;

  return (ink ? inkColors : paperColors)[color];
};

const formatDuration = (durationMs: number) => {
  const duration = Math.floor(clamp(durationMs, 0, Number.MAX_SAFE_INTEGER));
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60_000) {
    const seconds = Math.round(duration / 100) / 10;
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(duration / 60_000);
  const seconds = Math.floor((duration % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

const plainText = (line: string) =>
  parseAnsi(line)
    .map((segment) => segment.text)
    .join("");

export function TerminalBlock({
  command,
  lines,
  visibleCount,
  done,
  variant = "paper",
  exitCode: exitCodeProp,
  stderr,
  cwd,
  durationMs,
  truncated,
  maxCollapsedLines,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  | "children"
  | "command"
  | "lines"
  | "visibleCount"
  | "done"
  | "variant"
  | "exitCode"
  | "stderr"
  | "cwd"
  | "durationMs"
  | "truncated"
  | "maxCollapsedLines"
> & {
  command: string;
  lines: readonly string[];
  visibleCount: number;
  done: boolean;
  variant?: "paper" | "ink" | undefined;
  exitCode?: number | undefined;
  stderr?: readonly string[] | undefined;
  cwd?: string | undefined;
  durationMs?: number | undefined;
  truncated?: boolean | undefined;
  maxCollapsedLines?: number | undefined;
}) {
  const ink = variant === "ink";
  const exitCode = exitCodeProp ?? 0;
  const failed = done && exitCode !== 0;
  const state = !done ? "running" : failed ? "failed" : "done";
  const output = [
    ...lines.map((line) => ({ line, stderr: false })),
    ...(stderr ?? []).map((line) => ({ line, stderr: true })),
  ];
  const revealedLines = take(output, visibleCount);
  const collapsedLines = Math.floor(
    clamp(maxCollapsedLines ?? revealedLines.length, 0, revealedLines.length),
  );
  const canCollapse =
    done &&
    maxCollapsedLines !== undefined &&
    revealedLines.length > collapsedLines;
  const [expanded, setExpanded] = useState(false);
  const displayedLines =
    canCollapse && !expanded
      ? take(revealedLines, collapsedLines)
      : revealedLines;
  const outputId = useId();
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  return (
    <div
      className={[sx(ink ? paint.s32 : paper, paint.s65), className].filter(Boolean).join(" ")}
      {...props}
      data-slot="terminal-block"
      data-state={state}
    >
      <div className={sx(paint.s33)}>
        <span
          className={[sx(paint.s34), ink ? sx(paint.s35) : sx(paint.s36)].filter(Boolean).join(" ")}
        >
          {cwd ? (
            <span
              className={ink ? sx(paint.s37) : sx(paint.s38)}
            >
              {cwd} ${" "}
            </span>
          ) : null}
          {command}
        </span>
        {done ? (
          <div className={sx(paint.s39)}>
            {failed ? (
              <XIcon className={sx(paint.s40)} />
            ) : (
              <CheckIcon className={sx(paint.s41)} />
            )}
            <span
              className={sx(mono, failed ? paint.s42 : ink ? paint.s43 : paint.s44)}
            >
              exit {exitCode}
            </span>
            {durationMs !== undefined ? (
              <span
                className={sx(mono, ink ? paint.s43 : paint.s44)}
              >
                {formatDuration(durationMs)}
              </span>
            ) : null}
            {output.length > 0 ? (
              <button
                type="button"
                aria-label="Copy output"
                onClick={() =>
                  copyToClipboard(
                    output.map(({ line }) => plainText(line)).join("\n"),
                  )
                }
                className={sx(ghostButton, paint.s45, ink && paint.s46)}
              >
                {isCopied ? (
                  <CheckIcon className={sx(paint.s47)} />
                ) : (
                  <CopyIcon className={sx(paint.s48)} />
                )}
              </button>
            ) : null}
          </div>
        ) : (
          <Loader2Icon
            className={sx(paint.s49, spin, ink ? paint.s50 : paint.s51)}
          />
        )}
      </div>
      <div
        className={[sx(paint.s52), ink ? sx(paint.s53) : sx(paint.s54)].filter(Boolean).join(" ")}
      >
        <div id={outputId} className={sx(paint.s55)}>
          {displayedLines.map(({ line, stderr: isStderr }, index) => {
            const isLast = index === revealedLines.length - 1;
            return (
              <div
                key={`${index}-${line}`}
                className={sx(
                  fadeIn,
                  paint.s56,
                  isStderr && paint.s57,
                  !isStderr && isLast && (ink ? paint.s35 : paint.s36),
                )}
              >
                {parseAnsi(line).map((segment, segmentIndex) => (
                  <span
                    key={segmentIndex}
                    className={sx(
                      !isStderr && segment.color !== undefined && ansiColor(segment.color, ink),
                      segment.bold && paint.s58,
                      segment.dim && paint.s59,
                    )}
                  >
                    {segment.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
        {canCollapse ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={outputId}
            onClick={() => setExpanded((value) => !value)}
            className={sx(ghostButton, paint.s60, ink && paint.s61)}
          >
            {expanded ? "Show less" : `Show all ${revealedLines.length} lines`}
          </button>
        ) : null}
        {truncated ? (
          <span
            className={sx(mono, ink ? paint.s62 : paint.s63)}
          >
            output truncated
          </span>
        ) : null}
        {!done && (
          <span
            aria-hidden
            className={sx(paint.s64, pulse)}
          />
        )}
      </div>
    </div>
  );
}
