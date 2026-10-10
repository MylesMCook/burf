import * as stylex from "@stylexjs/stylex";
import "./art.css";

import { ArrowUpRightIcon, PanelRightIcon } from "lucide-react";
import { Suspense, useContext, useEffect, useState } from "react";

import { ArtView } from "@/components/art/art-view";
import { kindOf, kindWord } from "@/components/art/kinds";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { ago } from "@/lib/format";
import { type Art, atMs, latest, useArt, useArtBody, useArtifact } from "@/lib/art/model";
import { openArtifact } from "@/lib/art/open";
import { PaneContext } from "@/lib/pane-context";
import type { TranscriptItem } from "@/lib/transcript";

const paint = stylex.create({
  s0: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s1: {
    "cursor": "pointer",
  },
  s2: {
    "display": "block",
    "height": "16px",
    "width": "160px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
  },
  s3: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontVariantNumeric": "tabular-nums",
  },
  s4: {
    "color": "var(--success-foreground)",
  },
  s5: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "0.3125rem",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontWeight": 500,
    "fontSize": "0.6875rem",
    "fontVariantNumeric": "tabular-nums",
    "lineHeight": "1.0625rem",
  },
  s6: {
    "borderColor": "color-mix(in oklab, var(--info) 40%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "color": "var(--info-foreground)",
  },
  s7: {
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "color": "var(--muted-foreground)",
  },
  s8: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--info)",
  },
  s9: {
    "width": "min(100%,40rem)",
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "height": "6.5rem",
    "width": "min(100%,40rem)",
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s11: {
    "display": "flex",
    "width": "min(100%,40rem)",
    "minWidth": "0px",
    "alignSelf": "flex-start",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "fontSize": "0.8125rem",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s12: {
    "borderColor": "color-mix(in oklab, var(--info) 50%, transparent)",
  },
  s13: {
    "position": "relative",
    "display": "none",
    "width": "13.5rem",
    "flexShrink": 0,
    "overflow": "hidden",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "padding": "8px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s14: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "backgroundColor": "color-mix(in oklab, var(--foreground) 0%, transparent)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    ":is(.group:hover &)": {
      "backgroundColor": "color-mix(in oklab, var(--foreground) 4%, transparent)",
    },
  },
  s15: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "justifyContent": "center",
    "gap": "4px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "paddingRight": "6px",
    "paddingLeft": "12px",
  },
  s16: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s17: {
    "color": "var(--muted-foreground)",
  },
  s18: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s19: {
    "marginLeft": "auto",
  },
  s20: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
  },
  s21: {
    "fontWeight": 500,
  },
  s22: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "columnGap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "flexShrink": 0,
  },
  s24: {
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s25: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s26: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--warning-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "display": "flex",
    "width": "min(100%,40rem)",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--info) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 5%, transparent)",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "paddingRight": "4px",
    "paddingLeft": "10px",
    "fontSize": "0.8125rem",
  },
  s28: {
    "color": "var(--info-foreground)",
  },
  s29: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s30: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s31: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s32: {
    "display": "none",
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s33: {
    "marginLeft": "auto",
  },
  s34: {
    "flexShrink": 0,
  },
  n0: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontVariantNumeric": "tabular-nums",
  },
  n1: {
    "color": "var(--success-foreground)",
  },
  n2: {
    "color": "var(--destructive-foreground)",
  },
  n3: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },

  s35: {
    containerType: "inline-size",
  },
  s36: {
    "@container (min-width: 420px)": {
      display: "block",
    },
  },
  s37: {
    "@container (min-width: 520px)": {
      display: "inline",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The chat's side of an artifact: a card where the agent made it, with a
// live thumbnail, the headline its data gives, what it is, its version and
// age. A click opens it in a tab; ⌘-click (or Open beside) beside the chat.

export const when = (iso: string) => ago(iso);

export function ArtGlyph({ art, body, className }: { art: Art; body?: string; className?: string }) {
  const Icon = kindOf(art.kind).icon(body);
  return <Icon className={[sx(paint.s0), className].filter(Boolean).join(" ")} aria-hidden />;
}

// usePulse is true for a few seconds after a new version arrived.
export function usePulse(id: string): boolean {
  const at = useArt((s) => s.pulse[id]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!at) return;
    const t = window.setTimeout(() => tick((n) => n + 1), Math.max(0, at + 6000 - Date.now()));
    return () => window.clearTimeout(t);
  }, [at]);
  return !!at && Date.now() - at < 6000;
}

// Press is a click target that holds a thumbnail: a div acting as a button.
export function Press({ onPress, className, children, label }: { onPress(e: React.MouseEvent | React.KeyboardEvent): void; className?: string; children: React.ReactNode; label: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      className={[sx(paint.s1), className].filter(Boolean).join(" ")}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress(e);
        }
      }}
    >
      {children}
    </div>
  );
}

// GistLine is the headline a card, tile or tab leads with.
export function GistLine({ art, className }: { art: Art; className?: string }) {
  const { body } = useArtBody(art);
  const g = body === undefined ? undefined : kindOf(art.kind).gist?.(art, body);
  if (!g) return body === undefined ? <span className={[[sx(paint.s2), "burf-pulse"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")} /> : null;
  return (
    <span data-art-gist className={[sx(paint.n0), g.tone === "good" ? sx(paint.n1) : g.tone === "bad" ? sx(paint.n2) : sx(paint.n3), className].filter(Boolean).join(" ")}>
      {g.text}
    </span>
  );
}

// KindChips is the row a kind puts under the headline (a visual diff's
// "/search at 375 scrolls sideways"), if it has one.
export function KindChips({ art, className }: { art: Art; className?: string }) {
  const { body } = useArtBody(art);
  const Chips = kindOf(art.kind).Chips;
  if (!Chips || body === undefined) return null;
  return (
    <div className={className} data-art-chips>
      <Suspense fallback={null}>
        <Chips art={art} body={body} />
      </Suspense>
    </div>
  );
}

export function KindWord({ art }: { art: Art }) {
  const { body } = useArtBody(art);
  return <>{kindWord(art, body)}</>;
}

export function Version({ art, pulse }: { art: Art; pulse: boolean }) {
  return (
    <span data-art-version className={[sx(paint.s5), pulse ? sx(paint.s6) : sx(paint.s7)].filter(Boolean).join(" ")}>
      {pulse && <span className={[sx(paint.s8), "art-dot"].filter(Boolean).join(" ")} aria-hidden />}v{latest(art).n}
    </span>
  );
}

const helperName = (h: string) => h.replace(/^Explore:\s*/, "");

export function LocalArtifactCard({ it }: { it: Extract<TranscriptItem, { kind: "artifact" }> }) {
  const pane = useContext(PaneContext);
  const art = useArtifact(it.local, pane?.worktree);
  const loaded = useArt((s) => !pane?.worktree || pane.worktree in s.byWt);
  if (!art)
    return loaded ? (
      <div className={[sx(paint.s9), "cv-in"].filter(Boolean).join(" ")}>“{it.text}” is no longer on the box</div>
    ) : (
      <div className={[sx(paint.s10), "burf-pulse cv-in"].filter(Boolean).join(" ")} />
    );
  if (it.updated) return <UpdateLine art={art} it={it} />;
  return <Card art={art} />;
}

function useOpen(art: Art) {
  const pane = useContext(PaneContext);
  const from = pane ? { wsKey: pane.wsKey, tab: pane.tab, pane: pane.pane } : undefined;
  return (e?: React.MouseEvent | React.KeyboardEvent, split?: boolean) => openArtifact(art, { split: split ?? (!!e && (e.metaKey || e.ctrlKey)), from });
}

function Card({ art }: { art: Art }) {
  const pulse = usePulse(art.id);
  const v = latest(art);
  const open = useOpen(art);
  const note = art.by.helper ? `by ${helperName(art.by.helper)}` : v.note;
  return (
    <div data-art-card={art.id} data-testid="art-card" className={[[sx(paint.s11), [sx(paint.s35), "cv-in"].filter(Boolean).join(" ")].filter(Boolean).join(" "), pulse && [sx(paint.s12), "art-pulse"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
      <Press onPress={(e) => open(e)} label={`Open ${art.title}`} className={[sx(paint.s13), [sx(paint.s36), "group"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
        <ArtView art={art} size="thumb" height={84} />
        <span className={sx(paint.s14)} />
      </Press>
      <div className={sx(paint.s15)}>
        <div className={sx(paint.s16)}>
          <ArtGlyph art={art} className={sx(paint.s17)} />
          <span className={sx(paint.s18)} data-art-title>
            {art.title}
          </span>
          <span className={sx(paint.s19)} />
          <span className={sx(paint.s20)}>
            <Tip label="Open beside the chat · ⌘-click">
              <Button size="icon-xs" variant="ghost"  aria-label={`Open ${art.title} beside the chat`} onClick={(e) => open(e, true)} muted>
                <PanelRightIcon />
              </Button>
            </Tip>
            <Tip label="Open in a tab · ⌘-click opens it beside">
              <Button size="xs" variant="ghost"  onClick={(e) => open(e)} muted>
                Open
                <ArrowUpRightIcon />
              </Button>
            </Tip>
          </span>
        </div>
        <GistLine art={art} className={sx(paint.s21)} />
        <KindChips art={art} />
        <div className={sx(paint.s22)}>
          <span className={sx(paint.s23)}>
            <KindWord art={art} />
          </span>
          <span aria-hidden>·</span>
          <Version art={art} pulse={pulse} />
          <span aria-hidden>·</span>
          <span className={sx(paint.s24)}>{pulse ? "updated just now" : v.n > 1 ? `updated ${when(v.at)}` : when(v.at)}</span>
          {note && <span aria-hidden>·</span>}
          {note && <span className={sx(paint.s25)}>{note}</span>}
        </div>
        {art.problem && <span className={sx(paint.s26)}>Its latest rewrite wasn't taken: {art.problem}</span>}
      </div>
    </div>
  );
}

// A version made where the agent said so (add --note): one quiet line.
function UpdateLine({ art, it }: { art: Art; it: Extract<TranscriptItem, { kind: "artifact" }> }) {
  const open = useOpen(art);
  const n = it.version ?? latest(art).n;
  const note = art.versions.find((x) => x.n === n)?.note;
  return (
    <div data-art-card={art.id} data-testid="art-update" className={[sx(paint.s27), [sx(paint.s35), "cv-in"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
      <ArtGlyph art={art} className={sx(paint.s28)} />
      <span className={sx(paint.s29)}>Updated</span>
      <span className={sx(paint.s30)}>{art.title}</span>
      <span className={sx(paint.s31)}>to v{n}</span>
      {note && <span className={[sx(paint.s32), sx(paint.s37)].filter(Boolean).join(" ")}>· {note}</span>}
      <span className={sx(paint.s33)} />
      <Tip label="Open · ⌘-click beside the chat">
        <span className={sx(paint.s34)}><Button size="xs" variant="ghost"  onClick={(e) => open(e)} muted>
          Open
          <ArrowUpRightIcon />
        </Button></span>
      </Tip>
    </div>
  );
}

export const artTime = (a: Art) => atMs(latest(a));
