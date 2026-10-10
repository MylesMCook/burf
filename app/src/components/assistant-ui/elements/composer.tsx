"use client";

import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, useMemo } from "react";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  FileArchiveIcon,
  FileImageIcon,
  FileTextIcon,
  Loader2Icon,
  MicIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import {
  field,
  floating,
  ghostButton,
  iconSwap,
  iconSwapIn,
  iconSwapOut,
  inkButton,
  mono,
  paper,
  ShimmerLabel,
} from "./surfaces";
import { clamp, pct } from "../utils/range";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "width": "100%",
  },
  s1: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "8px",
    "borderRadius": "24px",
    "padding": "10px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s2: {
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, #3b82f6 4%, transparent), color-mix(in oklab, #3b82f6 10%, transparent))",
    },
  },
  s3: {
    "position": "absolute",
    "bottom": "100%",
    "zIndex": 10,
    "marginBottom": "8px",
    "display": "flex",
    "width": "288px",
    "flexDirection": "column",
    "gap": "2px",
    "borderRadius": "var(--radius-2xl)",
    "padding": "6px",
  },
  s4: {
    "insetInlineStart": "0px",
  },
  s5: {
    "insetInlineEnd": "0px",
  },
  s6: {
    "transitionDuration": "200ms",
    "transitionTimingFunction": "linear",
  },
  s7: {
    "transform": "scale(1)",
    "opacity": 1,
  },
  s8: {
    "pointerEvents": "none",
    "transform": "scale(NaN)",
    "opacity": 0,
  },
  s9: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "10px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "13.5px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s10: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 4%, transparent)",
    },
  },
  s11: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s12: {
    "fontWeight": 500,
  },
  s13: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 6%, transparent)",
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
  },
  s15: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 6%, transparent)",
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "fontSize": "9px",
    "fontWeight": 500,
  },
  s16: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s17: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
  },
  s18: {
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "8px",
  },
  s19: {
    "position": "relative",
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "overflow": "hidden",
    "borderRadius": "14px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "paddingInlineStart": "6px",
    "paddingInlineEnd": "10px",
  },
  s20: {
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, #fff 10%, transparent))",
    },
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "display": "flex",
    "width": "32px",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "10px",
  },
  s21: {
    "width": "16px",
    "height": "16px",
  },
  s22: {
    "display": "flex",
    "flexDirection": "column",
  },
  s23: {
    "maxWidth": "144px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
  },
  s24: {
    "fontSize": "11px",
  },
  s25: {
    "color": {
      "default": "light-dark(unset, color-mix(in oklab, #f87171 80%, transparent))",
    },
  },
  s26: {
    "color": "color-mix(in oklab, var(--foreground) 40%, transparent)",
  },
  s27: {
    "marginInlineStart": "4px",
    "display": "flex",
    "width": "20px",
    "alignItems": "center",
    "justifyContent": "flex-end",
  },
  s28: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "width": "14px",
    "height": "14px",
  },
  s29: {
    "width": "20px",
    "height": "20px",
    ":not(#\\#) svg": {
      "width": "12px",
      "height": "12px",
    },
  },
  s30: {
    "width": "14px",
    "height": "14px",
    "color": "#10b981",
  },
  s31: {
    "position": "absolute",
    "left": 0,
    "right": 0,
    "bottom": "0px",
    "height": "2px",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, #3b82f6 70%, transparent), color-mix(in oklab, #60a5fa 70%, transparent))",
    },
    "transitionDuration": "300ms",
  },
  s32: {
    "color": {
      "::placeholder": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    },
    "minHeight": "44px",
    "width": "100%",
    "backgroundColor": "transparent",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "15px",
    "caretColor": {
      "default": "light-dark(#3b82f6, #60a5fa)",
    },
    "outline": "none",
  },
  s33: {
    "display": "flex",
    "minHeight": "44px",
    "alignItems": "center",
    "gap": "12px",
    "paddingInlineStart": "12px",
  },
  s34: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": {
      "default": "light-dark(#3b82f6, #60a5fa)",
    },
  },
  s35: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
    "gap": "3px",
  },
  s36: {
    "width": "2px",
    "borderRadius": "999px",
    "transitionDuration": "150ms",
  },
  s37: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 50%, transparent)",
  },
  s38: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 25%, transparent)",
  },
  s39: {
    "color": "color-mix(in oklab, var(--foreground) 40%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s40: {
    "color": "color-mix(in oklab, var(--foreground) 55%, transparent)",
    "position": "relative",
    "fontSize": "13px",
  },
  s41: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
  },
  s42: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s43: {
    "width": "32px",
    "height": "32px",
    "pointerEvents": {
      ":disabled": "none",
    },
    "opacity": {
      ":disabled": 0.3,
    },
  },
  s44: {
    "width": "16px",
    "height": "16px",
  },
  s45: {
    "color": {
      "default": "color-mix(in oklab, var(--foreground) 55%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    },
    "backgroundColor": {
      ":hover": "light-dark(color-mix(in oklab, var(--foreground) 6%, transparent), color-mix(in oklab, var(--foreground) 9%, transparent))",
    },
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "999px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "12.5px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s46: {
    "width": "12px",
    "height": "12px",
    "opacity": 0.6,
  },
  s47: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s48: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s49: {
    "display": "flex",
    "width": "16px",
    "justifyContent": "flex-end",
  },
  s50: {
    "width": "14px",
    "height": "14px",
    "transitionDuration": "200ms",
  },
  s51: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 25%, transparent)",
  },
  s52: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 45%, transparent)",
  },
  s53: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s54: {
    "position": "relative",
  },
  s55: {
    "position": "absolute",
    "insetInlineEnd": "0px",
    "bottom": "100%",
    "zIndex": 10,
    "marginBottom": "8px",
    "display": "flex",
    "width": "240px",
    "flexDirection": "column",
    "gap": "14px",
    "borderRadius": "var(--radius-2xl)",
    "padding": "16px",
  },
  s56: {
    "transitionDuration": "200ms",
    "transitionTimingFunction": "linear",
  },
  s57: {
    "pointerEvents": "none",
    "transform": "scale(NaN)",
    "opacity": 0,
  },
  s58: {
    ":is(.group\\/ctx:hover &)": {
      "pointerEvents": "auto",
      "transform": "scale(1)",
      "opacity": 1,
    },
  },
  s59: {
    ":is(.group\\/ctx:focus-within &)": {
      "pointerEvents": "auto",
      "transform": "scale(1)",
      "opacity": 1,
    },
  },
  s60: {
    "display": "flex",
    "alignItems": "baseline",
    "justifyContent": "space-between",
  },
  s61: {
    "fontSize": "13.5px",
    "fontWeight": 500,
  },
  s62: {
    "fontVariantNumeric": "tabular-nums",
  },
  s63: {
    "color": {
      "default": "light-dark(#ef4444, #f87171)",
    },
  },
  s64: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
  },
  s65: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 6%, transparent)",
    "display": "flex",
    "height": "5px",
    "width": "100%",
    "gap": "1px",
    "overflow": "hidden",
    "borderRadius": "999px",
  },
  s66: {
    "height": "100%",
    "transitionDuration": "700ms",
  },
  s67: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
  },
  s68: {
    "color": "color-mix(in oklab, var(--foreground) 55%, transparent)",
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "fontSize": "13px",
  },
  s69: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s70: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s71: {
    "color": "color-mix(in oklab, var(--foreground) 40%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s72: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 6%, transparent)",
    "height": "1px",
  },
  s73: {
    "color": "color-mix(in oklab, var(--foreground) 55%, transparent)",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "fontSize": "13px",
  },
  s74: {
    "color": "color-mix(in oklab, var(--foreground) 40%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s75: {
    "width": "32px",
    "height": "32px",
  },
  s76: {
    "color": {
      "default": "light-dark(#ef4444, #f87171)",
    },
  },
  s77: {
    "width": "16px",
    "height": "16px",
  },
  s78: {
    "stroke": "color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
  s79: {
    "stroke": "currentColor",
    "transitionDuration": "700ms",
  },
  s80: {
    "width": "12px",
    "height": "12px",
    "fill": "currentColor",
  },
  s81: {
    "width": "16px",
    "height": "16px",
  },
  s82: {
    "display": "grid",
    "width": "32px",
    "height": "32px",
    "placeItems": "center",
    "borderRadius": "999px",
  },
  s83: {
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--foreground) 6%, transparent), color-mix(in oklab, var(--foreground) 9%, transparent))",
    },
    "color": "color-mix(in oklab, var(--foreground) 30%, transparent)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s84: {
    "width": "16px",
    "height": "16px",
  },
  s85: {
    "width": "12px",
    "height": "12px",
    "fill": "currentColor",
  },
  n0: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "10px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "13.5px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  n1: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 4%, transparent)",
    },
  },
  n2: {
    "display": "flex",
    "width": "32px",
    "height": "32px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
  },
  n3: {
    "width": "32px",
    "height": "32px",
  },
  n4: {
    "display": "grid",
    "width": "32px",
    "height": "32px",
    "placeItems": "center",
    "borderRadius": "999px",
  },
  n5: {
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--foreground) 6%, transparent), color-mix(in oklab, var(--foreground) 9%, transparent))",
    },
    "color": "color-mix(in oklab, var(--foreground) 30%, transparent)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  n6: {
    "width": "16px",
    "height": "16px",
  },
  n7: {
    "width": "12px",
    "height": "12px",
    "fill": "currentColor",
  },
  q86: {
    "transitionProperty": "opacity,scale",
    "transitionDuration": "150ms",
  },
  q87: {
    "textAlign": "start",
  },
  q88: {
    "textAlign": "start",
  },
  q89: {
    "color": "color-mix(in oklab, #dc2626 80%, transparent)",
  },
  q90: {
    "transitionProperty": "width",
    "transitionDuration": "150ms",
  },
  q91: {
    "transitionProperty": "height,background-color",
    "transitionDuration": "150ms",
  },
  q92: {
    "textAlign": "start",
  },
  q93: {
    "transitionProperty": "opacity,scale",
    "transitionDuration": "150ms",
  },
  q94: {
    "transitionProperty": "width",
    "transitionDuration": "150ms",
  },
  q95: {
    "transitionProperty": "stroke-dashoffset",
    "transitionDuration": "150ms",
  },
  q96: {
    "maxWidth": "32rem",
  },
  q97: {
    "transformOrigin": "bottom left",
  },
  q98: {
    "transformOrigin": "bottom right",
  },
  q99: {
    "transformOrigin": "bottom right",
  },
  q100: {
    "transform": "rotate(-90deg)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface ComposerAttachment {
  name: string;
  meta: string;
  state: "uploading" | "done" | "error";
  progress?: number;
  kind?: "image" | "text" | "archive";
}

export interface ComposerCommand {
  name: string;
  description: string;
  icon: LucideIcon;
}

export interface ComposerPerson {
  name: string;
  role: "agent" | "human";
}

export interface ComposerModel {
  name: string;
  meta: string;
}

export interface ComposerUsage {
  system: number;
  tools: number;
  messages: number;
  total: number;
}

const ATTACHMENT_ICONS: Record<
  NonNullable<ComposerAttachment["kind"]>,
  LucideIcon
> = {
  image: FileImageIcon,
  text: FileTextIcon,
  archive: FileArchiveIcon,
};

const BARS = Array.from({ length: 14 }, (_, i) => i);

function barHeight(bar: number, tick: number): number {
  return 5 + Math.abs(Math.sin(bar * 1.35 + tick * 0.55)) * 13;
}

/** Commands whose name starts with the slash query, or none when not typing one. */
export function useSlashMatches(
  value: string,
  commands: readonly ComposerCommand[] | undefined,
): ComposerCommand[] {
  return useMemo(() => {
    if (!commands || !value.startsWith("/")) return [];
    const query = value.slice(1).toLowerCase();
    return commands.filter((command) => command.name.startsWith(query));
  }, [commands, value]);
}

/** People matching a trailing @mention, or none when the caret is not in one. */
export function useMentionMatches(
  value: string,
  people: readonly ComposerPerson[] | undefined,
): ComposerPerson[] {
  return useMemo(() => {
    if (!people) return [];
    const match = /@([\w]*)$/.exec(value);
    if (!match) return [];
    const query = match[1]?.toLowerCase() ?? "";
    return people.filter((person) =>
      person.name.toLowerCase().startsWith(query),
    );
  }, [people, value]);
}

/** Replaces the trailing @mention with the chosen name. */
export function applyMention(value: string, name: string): string {
  return value.replace(/@[\w]*$/, `@${name} `);
}

export function Composer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer"
      className={[[sx(paint.s0), sx(paint.q96)].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerBar({
  dragActive = false,
  className,
  ...props
}: ComponentProps<"div"> & { dragActive?: boolean }) {
  return (
    <div
      data-slot="composer-bar"
      data-drag-active={dragActive || undefined}
      className={[paper, sx(paint.s1), dragActive && sx(paint.s2), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerMenu({
  open,
  align = "start",
  className,
  ...props
}: ComponentProps<"div"> & { open: boolean; align?: "start" | "end" }) {
  return (
    <div
      data-slot="composer-menu"
      data-open={open || undefined}
      className={[floating, sx(paint.s3), align === "start" ? [sx(paint.s4), sx(paint.q97)].filter(Boolean).join(" ") : [sx(paint.s5), sx(paint.q98)].filter(Boolean).join(" "), [sx(paint.s6), sx(paint.q86)].filter(Boolean).join(" "), open ? sx(paint.s7) : sx(paint.s8), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerMenuItem({
  active = false,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="composer-menu-item"
      data-active={active || undefined}
      className={[sx(paint.n0, active ? field : paint.n1), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerCommandItem({
  command,
  active,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  command: ComposerCommand;
  active: boolean;
}) {
  return (
    <ComposerMenuItem active={active} {...props}>
      <command.icon className={sx(paint.s11)} />
      <span className={sx(paint.s12)}>/{command.name}</span>
      <span className={[sx(paint.s13), sx(paint.q87)].filter(Boolean).join(" ")}>
        {command.description}
      </span>
      {active && (
        <kbd className={sx(paint.s14)}>
          ↵
        </kbd>
      )}
    </ComposerMenuItem>
  );
}

export function ComposerPersonItem({
  person,
  active,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  person: ComposerPerson;
  active: boolean;
}) {
  return (
    <ComposerMenuItem active={active} {...props}>
      <span className={sx(paint.s15)}>
        {person.name[0]}
      </span>
      <span className={[sx(paint.s16), sx(paint.q88)].filter(Boolean).join(" ")}>{person.name}</span>
      <span className={[mono, sx(paint.s17)].filter(Boolean).join(" ")}>{person.role}</span>
    </ComposerMenuItem>
  );
}

export function ComposerAttachments({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-attachments"
      className={[sx(paint.s18), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerAttachmentChip({
  attachment,
  onRemove,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  attachment: ComposerAttachment;
  onRemove?: (name: string) => void;
}) {
  const Icon = ATTACHMENT_ICONS[attachment.kind ?? "text"];
  return (
    <div
      data-slot="composer-attachment"
      data-state={attachment.state}
      className={[field, sx(paint.s19), className].filter(Boolean).join(" ")}
      {...props}
    >
      <span className={sx(paint.s20)}>
        <Icon className={sx(paint.s21)} />
      </span>
      <span className={sx(paint.s22)}>
        <span className={sx(paint.s23)}>
          {attachment.name}
        </span>
        <span
          className={[sx(paint.s24), attachment.state === "error" ? [sx(paint.s25), sx(paint.q89)].filter(Boolean).join(" ") : sx(paint.s26)].filter(Boolean).join(" ")}
        >
          {attachment.meta}
        </span>
      </span>
      <span className={sx(paint.s27)}>
        {attachment.state === "uploading" ? (
          <Loader2Icon className={[sx(paint.s28), "burf-spin"].filter(Boolean).join(" ")} />
        ) : attachment.state === "done" && onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${attachment.name}`}
            onClick={() => onRemove(attachment.name)}
            className={[ghostButton, sx(paint.s29)].filter(Boolean).join(" ")}
          >
            <XIcon />
          </button>
        ) : attachment.state === "done" ? (
          <CheckIcon className={sx(paint.s30)} />
        ) : null}
      </span>
      {attachment.state === "uploading" && (
        <span
          aria-hidden
          className={[sx(paint.s31), sx(paint.q90)].filter(Boolean).join(" ")}
          style={{ width: `${pct(attachment.progress ?? 0, 100)}%` }}
        />
      )}
    </div>
  );
}

export function ComposerInput({
  onSubmit,
  onKeyDown,
  className,
  ...props
}: Omit<ComponentProps<"input">, "onSubmit"> & { onSubmit?: () => void }) {
  return (
    <input
      data-slot="composer-input"
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        onSubmit?.();
      }}
      className={[sx(paint.s32), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerVoice({
  recording,
  seconds,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  recording: boolean;
  seconds: number;
}) {
  return (
    <div
      data-slot="composer-voice"
      data-recording={recording || undefined}
      className={[sx(paint.s33), className].filter(Boolean).join(" ")}
      {...props}
    >
      {recording && (
        <span
          aria-hidden
          className={[sx(paint.s34), "burf-pulse"].filter(Boolean).join(" ")}
        />
      )}
      <div className={sx(paint.s35)} aria-hidden>
        {BARS.map((bar) => (
          <span
            key={bar}
            className={[[sx(paint.s36), sx(paint.q91)].filter(Boolean).join(" "), recording ? sx(paint.s37) : sx(paint.s38)].filter(Boolean).join(" ")}
            style={{ height: recording ? barHeight(bar, seconds * 10) : 3 }}
          />
        ))}
      </div>
      {recording ? (
        <span className={[mono, sx(paint.s39)].filter(Boolean).join(" ")}>
          0:{String(seconds).padStart(2, "0")}
        </span>
      ) : (
        <ShimmerLabel className={sx(paint.s40)}>
          Transcribing
        </ShimmerLabel>
      )}
    </div>
  );
}

export function ComposerToolbar({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-toolbar"
      className={[sx(paint.s41), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerActions({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-actions"
      className={[sx(paint.s42), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function ComposerAttachButton({
  className,
  ...props
}: Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      aria-label="Add attachment"
      data-slot="composer-attach"
      disabled={!props.onClick}
      className={[ghostButton, sx(paint.s43), className].filter(Boolean).join(" ")}
      {...props}
    >
      <PlusIcon className={sx(paint.s44)} />
    </button>
  );
}

export function ComposerModelTrigger({
  model,
  open,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  model: string;
  open: boolean;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      data-slot="composer-model-trigger"
      className={[sx(paint.s45), className].filter(Boolean).join(" ")}
      {...props}
    >
      {model}
      <ChevronDownIcon className={sx(paint.s46)} />
    </button>
  );
}

export function ComposerModelItem({
  entry,
  selected,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  entry: ComposerModel;
  selected: boolean;
}) {
  return (
    <ComposerMenuItem active={selected} {...props}>
      <span className={[sx(paint.s47), sx(paint.q92)].filter(Boolean).join(" ")}>{entry.name}</span>
      <span className={[mono, sx(paint.s48)].filter(Boolean).join(" ")}>
        {entry.meta}
      </span>
      <span className={sx(paint.s49)}>
        {selected && (
          <CheckIcon className={[sx(paint.s50), "burf-fade"].filter(Boolean).join(" ")} />
        )}
      </span>
    </ComposerMenuItem>
  );
}

export function ComposerContext({
  usage,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & { usage: ComposerUsage }) {
  const used = usage.system + usage.tools + usage.messages;
  const fraction = usage.total === 0 ? 0 : used / usage.total;
  const warn = fraction > 0.85;
  const circumference = 2 * Math.PI * 6;
  const segments = [
    { label: "System", value: usage.system, className: sx(paint.s51) },
    { label: "Tools", value: usage.tools, className: sx(paint.s52) },
    { label: "Messages", value: usage.messages, className: sx(paint.s53) },
  ];

  return (
    <div
      data-slot="composer-context"
      className={[[sx(paint.s54), "group/ctx"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    >
      <div
        className={[floating, [sx(paint.s55), sx(paint.q99)].filter(Boolean).join(" "), [sx(paint.s56), sx(paint.q93)].filter(Boolean).join(" "), sx(paint.s57), sx(paint.s58), sx(paint.s59)].filter(Boolean).join(" ")}
      >
        <div className={sx(paint.s60)}>
          <p className={sx(paint.s61)}>Context</p>
          <p
            className={[mono, sx(paint.s62), warn ? sx(paint.s63) : sx(paint.s64)].filter(Boolean).join(" ")}
          >
            {Math.round(fraction * 100)}%
          </p>
        </div>
        <div className={sx(paint.s65)}>
          {segments.map((segment) => (
            <span
              key={segment.label}
              className={[[sx(paint.s66), sx(paint.q94)].filter(Boolean).join(" "), segment.className].filter(Boolean).join(" ")}
              style={{ width: `${pct(segment.value, usage.total)}%` }}
            />
          ))}
        </div>
        <div className={sx(paint.s67)}>
          {segments.map((segment) => (
            <div
              key={segment.label}
              className={sx(paint.s68)}
            >
              <span
                aria-hidden
                className={[sx(paint.s69), segment.className].filter(Boolean).join(" ")}
              />
              <span className={sx(paint.s70)}>{segment.label}</span>
              <span className={[mono, sx(paint.s71)].filter(Boolean).join(" ")}>
                {segment.value}k
              </span>
            </div>
          ))}
        </div>
        <div className={sx(paint.s72)} />
        <div className={sx(paint.s73)}>
          <span>Total</span>
          <span className={[mono, sx(paint.s74)].filter(Boolean).join(" ")}>
            {used}k / {usage.total}k
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label="Context usage"
        className={[ghostButton, sx(paint.s75), warn && sx(paint.s76)].filter(Boolean).join(" ")}
      >
        <svg viewBox="0 0 16 16" className={[sx(paint.s77), sx(paint.q100)].filter(Boolean).join(" ")} aria-hidden>
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            strokeWidth="2.5"
            className={sx(paint.s78)}
          />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={[sx(paint.s79), sx(paint.q95)].filter(Boolean).join(" ")}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamp(fraction, 0, 1))}
          />
        </svg>
      </button>
    </div>
  );
}

export function ComposerVoiceButton({
  active,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-label={active ? "Stop recording" : "Start voice input"}
      data-slot="composer-voice-button"
      className={[active ? [inkButton, sx(paint.n2)].filter(Boolean).join(" ") : [ghostButton, sx(paint.n3)].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    >
      {active ? (
        <SquareIcon className={sx(paint.s80)} />
      ) : (
        <MicIcon className={sx(paint.s81)} />
      )}
    </button>
  );
}

export function ComposerSend({
  streaming,
  idle,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  streaming: boolean;
  idle: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={streaming ? "Stop generating" : "Send message"}
      data-slot="composer-send"
      className={[sx(paint.n4, streaming || !idle ? inkButton : paint.n5), className].filter(Boolean).join(" ")}
      {...props}
    >
      <ArrowUpIcon
        className={sx(iconSwap, paint.n6, streaming ? iconSwapOut : iconSwapIn)}
      />
      <SquareIcon
        className={sx(iconSwap, paint.n7, streaming ? iconSwapIn : iconSwapOut)}
      />
    </button>
  );
}
