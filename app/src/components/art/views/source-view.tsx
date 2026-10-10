import * as stylex from "@stylexjs/stylex";
import type { ViewProps } from "@/components/art/kinds";
import { Thumb } from "@/components/art/thumb";

const paint = stylex.create({
  s0: {
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "padding": "12px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// An artifact's source as text: the source view, and the viewer for a kind
// this app doesn't know yet.
export default function SourceView({ body, size, height }: ViewProps) {
  const pre = <pre className={sx(paint.s0)}>{body}</pre>;
  if (size === "thumb")
    return (
      <Thumb h={height ?? 120} width={520}>
        {pre}
      </Thumb>
    );
  return pre;
}
