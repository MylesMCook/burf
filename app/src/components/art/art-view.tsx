import * as stylex from "@stylexjs/stylex";
import "./art.css";

import { Suspense, useMemo } from "react";

import { kindOf, type ViewSize } from "@/components/art/kinds";
import { useActiveTheme } from "@/hooks/use-theme";
import { type Art, type ArtVersion, latest, useArtBody } from "@/lib/art/model";
import { chartVars } from "@/lib/art/theme";

const paint = stylex.create({
  s0: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
  },
  s1: {
    "position": "relative",
    "minHeight": "0px",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "padding": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// ArtView is one version of an artifact at a size: a thumbnail (a card,
// the board) or the whole of a tab. Its kind's viewer (kinds.tsx) is
// loaded the first time one is drawn, never at start-up.
export function ArtView({ art, version, size, height, className }: { art: Art; version?: ArtVersion; size: ViewSize; height?: number; className?: string }) {
  const theme = useActiveTheme();
  const vars = useMemo(() => chartVars(theme), [theme]);
  const v = version ?? latest(art);
  const { body, error } = useArtBody(art, v?.n);
  const spec = kindOf(art.kind);
  const wait = <div className={[sx(paint.s0), "burf-pulse"].filter(Boolean).join(" ")} style={{ height: height ?? (size === "thumb" ? 120 : 240) }} />;
  return (
    <div className={[[sx(paint.s1), "art-scope"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")} style={vars as React.CSSProperties} data-art-kind={art.kind} data-art-size={size}>
      {error ? (
        <div className={sx(paint.s2)} style={{ height: height ?? (size === "thumb" ? 120 : 160) }}>
          Couldn't read v{v?.n}: {error}
        </div>
      ) : body === undefined || !v ? (
        wait
      ) : (
        <Suspense fallback={wait}>
          <spec.View art={art} version={v} body={body} size={size} height={height} />
        </Suspense>
      )}
    </div>
  );
}
