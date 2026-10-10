import * as stylex from "@stylexjs/stylex";
import { AppWindowIcon, LockIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import type { ViewProps } from "@/components/art/kinds";
import { useActiveTheme } from "@/hooks/use-theme";
import { gist } from "@/lib/art/gist";
import { artOrigin } from "@/lib/art/origin";
import origin from "@/lib/art/origin.gen.json";
import { pageTheme, themeFragment } from "@/lib/art/theme";
import type { Theme } from "@/lib/api";

const paint = stylex.create({
  s0: {
    "display": "block",
    "height": "100%",
    "minHeight": "24rem",
    "width": "100%",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 0,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "transparent",
  },
  s1: {
    "display": "block",
    "height": "100%",
    "minHeight": "24rem",
    "width": "100%",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 0,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "transparent",
  },
  s2: {
    "pointerEvents": "none",
    "position": "relative",
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "6px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "padding": "10px",
  },
  s3: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "display": "none",
  },
  s5: {
    "width": "14px",
    "height": "14px",
  },
  s6: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "0.75rem",
    "color": "var(--foreground)",
  },
  s7: {
    "width": "12px",
    "height": "12px",
  },
  s8: {
    "fontWeight": 600,
    "fontSize": "0.8125rem",
    "lineHeight": "1.375",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s10: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
  },
  s11: {
    "fontSize": "0.6875rem",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.375",
  },
  s12: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
  },
  s13: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 3,
    "WebkitBoxOrient": "vertical",
  },
  s14: {
    "marginTop": "auto",
    "display": "flex",
    "gap": "4px",
  },
  s15: {
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab,var(--chart-1) 45%,transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A page: one HTML file an agent wrote, run on its own origin with no
// access to Burf or the network (internal/proxy/artifact.go). The app
// frames the proxy's shell, which frames the page; the theme goes in the
// URL's fragment (it never reaches a server) and, when it changes, as a
// message. Thumbnails are a poster, never a live page: a page runs only in
// a tab, so a busy one can't weigh on the chat or the board.

export default function PageView({ art, version, body, size, height }: ViewProps) {
  const theme = useActiveTheme();
  if (size === "thumb") return <Poster body={body} height={height ?? 120} title={art.title} />;
  const at = artOrigin(art.box, art.id);
  return at ? <Framed at={at} n={version.n} theme={theme} title={art.title} /> : <Srcdoc body={body} theme={theme} title={art.title} />;
}

function Framed({ at, n, theme, title }: { at: string; n: number; theme: Theme; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  // The address keeps the theme it opened with; later changes are messages.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a theme change is a message, not a reload
  const frag = useMemo(() => themeFragment(theme), [n, at]);
  const src = `${at}/?v=${n}${frag}`;
  const post = () => ref.current?.contentWindow?.postMessage(pageTheme(theme), at);
  // biome-ignore lint/correctness/useExhaustiveDependencies: post reads the current theme
  useEffect(post, [theme, at]);
  return (
    <iframe
      ref={ref}
      key={src}
      title={title}
      src={src}
      // The shell needs its own origin (the page's frame-ancestors names
      // it); the page inside is sandboxed to an opaque one.
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      allow=""
      data-art-frame="origin"
      onLoad={post}
      className={sx(paint.s0)}
      style={{ colorScheme: theme.appearance }}
    />
  );
}

// Mock mode: the same policy in a <meta>, the theme inline, an opaque
// origin from the sandbox.
const metaPolicy = origin.pagePolicy
  .split("; ")
  .filter((d) => !/^(sandbox|frame-ancestors|webrtc)\b/.test(d))
  .map((d) => d.replace(/ http:\/\/ORIGIN\/_lib\//, ""))
  .join("; ");

function Srcdoc({ body, theme, title }: { body: string; theme: Theme; title: string }) {
  const doc = useMemo(() => {
    const t = pageTheme(theme);
    const css = `:root{${Object.entries(t.vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";")};color-scheme:${t.scheme}}`;
    const head = `<meta http-equiv="Content-Security-Policy" content="${metaPolicy}">${origin.pageHead.replace('content="dark"', `content="${t.scheme}"`)}<style id="berth-theme">${css}</style>`;
    return /<head[^>]*>/i.test(body) ? body.replace(/<head[^>]*>/i, (m) => m + head) : head + body;
  }, [body, theme]);
  return <iframe title={title} srcDoc={doc} sandbox="allow-scripts" referrerPolicy="no-referrer" allow="" data-art-frame="srcdoc" className={sx(paint.s1)} style={{ colorScheme: theme.appearance }} />;
}

function Poster({ body, height, title }: { body: string; height: number; title: string }) {
  const g = gist("page", "html", body);
  const words = useMemo(() => body.replace(/<title[\s\S]*?<\/title>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim().slice(0, 220), [body]);
  return (
    <div className={sx(paint.s2)} style={{ height }} aria-hidden>
      <div className={[sx(paint.s3), height < 110 && sx(paint.s4)].filter(Boolean).join(" ")}>
        <AppWindowIcon className={sx(paint.s5)} />
        <span className={sx(paint.s6)}>{title}</span>
        <LockIcon className={sx(paint.s7)} />
      </div>
      {g && <div className={[sx(paint.s8), height < 110 ? sx(paint.s9) : sx(paint.s10)].filter(Boolean).join(" ")}>{g.text}</div>}
      <div className={[sx(paint.s11), height < 110 ? sx(paint.s12) : sx(paint.s13)].filter(Boolean).join(" ")}>{words}</div>
      <div className={sx(paint.s14)}>
        {[62, 40, 78].map((w) => (
          <span key={w} className={sx(paint.s15)} style={{ width: `${w / 3}%` }} />
        ))}
      </div>
    </div>
  );
}
