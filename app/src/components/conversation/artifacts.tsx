import * as stylex from "@stylexjs/stylex";
import { AppWindowIcon, ExternalLinkIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { openUrl } from "@/lib/open-url";
import type { TranscriptItem } from "@/lib/transcript";

const paint = stylex.create({
  s0: {
    "height": "6.5rem",
    "width": "min(100%,40rem)",
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s1: {
    "display": "flex",
    "width": "min(100%,40rem)",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "paddingLeft": "10px",
    "fontSize": "0.8125rem",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s2: {
    "paddingRight": "4px",
  },
  s3: {
    "paddingRight": "12px",
  },
  s4: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s5: {
    "color": "var(--destructive-foreground)",
  },
  s6: {
    "color": "var(--muted-foreground)",
  },
  s7: {
    "flexShrink": 0,
  },
  s8: {
    "minWidth": "0px",
    "flexShrink": 1,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s9: {
    "display": "none",
    "minWidth": "0px",
    "maxWidth": "22rem",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "marginLeft": "auto",
    "flexShrink": 0,
  },
  n0: {
    "flexShrink": 0,
  },
  n1: {
    "color": "var(--destructive-foreground)",
  },
  n2: {
    "color": "var(--muted-foreground)",
  },
  q11: {
    "display": {
      "@container (min-width: 640px)": {
        "default": "block",
      },
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const host = (url?: string) => {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
};

// ArtifactCard is a publish where it happened in the chat: the page's
// title, and Open once it has a link.
// An artifact kept on the box (components/art), loaded the first time a
// chat shows one.
const LocalArtifactCard = lazy(() => import("@/components/art/art-card").then((m) => ({ default: m.LocalArtifactCard })));

export function ArtifactCard({ it }: { it: Extract<TranscriptItem, { kind: "artifact" }> }) {
  // One kept on the box (berthd artifact add), not a page on claude.ai.
  if (it.local)
    return (
      <Suspense fallback={<div className={[sx(paint.s0), "burf-pulse cv-in"].filter(Boolean).join(" ")} />}>
        <LocalArtifactCard it={it} />
      </Suspense>
    );
  const publishing = !it.done && !it.url;
  const status = it.error ? "Didn't publish" : publishing ? "Publishing" : it.updated ? "Updated" : "Published";
  const sub = it.error ? undefined : it.description;
  return (
    <div className={[[sx(paint.s1), "cv-in"].filter(Boolean).join(" "), it.url ? sx(paint.s2) : sx(paint.s3)].filter(Boolean).join(" ")}>
      <AppWindowIcon className={[sx(paint.s4), it.error ? sx(paint.s5) : sx(paint.s6)].filter(Boolean).join(" ")} />
      <span className={[sx(paint.n0), publishing ? "cv-shimmer" : it.error ? sx(paint.n1) : sx(paint.n2)].filter(Boolean).join(" ")}>{status}</span>
      <span className={sx(paint.s8)}>{it.text}</span>
      {sub && <span className={[sx(paint.s9), sx(paint.q11)].filter(Boolean).join(" ")}>· {sub}</span>}
      {it.url && (
        <Tip label={host(it.url) ? `Open on ${host(it.url)}` : "Open in your browser"}>
          <span className={sx(paint.s10)}><Button size="xs" variant="ghost"  onClick={() => void openUrl(it.url!)} muted>
            Open
            <ExternalLinkIcon />
          </Button></span>
        </Tip>
      )}
    </div>
  );
}
