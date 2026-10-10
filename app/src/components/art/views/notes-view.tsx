import * as stylex from "@stylexjs/stylex";
import type { ViewProps } from "@/components/art/kinds";
import { Thumb } from "@/components/art/thumb";
import { Markdown } from "@/components/conversation/markdown";

const paint = stylex.create({
  s0: {
    "padding": "8px",
    "fontSize": "0.8125rem",
  },
  s1: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "width": "100%",
    "maxWidth": "46rem",
    "fontSize": "0.875rem",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Notes: Markdown through the chat's own renderer (no raw HTML).
export default function NotesView({ body, size, height }: ViewProps) {
  if (size === "thumb")
    return (
      <Thumb h={height ?? 120} width={520}>
        <div className={sx(paint.s0)}>
          <Markdown text={body} copy={false} />
        </div>
      </Thumb>
    );
  return (
    <div className={sx(paint.s1)} data-art-notes>
      <Markdown text={body} copy={false} />
    </div>
  );
}
