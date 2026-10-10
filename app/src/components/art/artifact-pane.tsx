import * as stylex from "@stylexjs/stylex";
import "./art.css";

import { BotIcon, ChevronDownIcon, CodeIcon, EyeIcon, HistoryIcon, LayoutGridIcon, LockIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { lazy, Suspense, useContext, useEffect, useMemo, useState } from "react";

import { ArtGlyph, GistLine, KindWord, usePulse, when } from "@/components/art/art-card";
import { ArtView } from "@/components/art/art-view";
import { kindOf } from "@/components/art/kinds";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Menu, MenuGroup, MenuGroupLabel, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { type Art, type ArtVersion, latest, sizeLabel, useArt, useArtBody, useArtifact } from "@/lib/art/model";
import { openBoard } from "@/lib/art/open";
import { PaneContext } from "@/lib/pane-context";

const paint = stylex.create({
  s0: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s1: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "24px",
  },
  s2: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "color-mix(in oklab, var(--muted) 20%, transparent)",
  },
  s3: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "backgroundColor": "var(--background)",
  },
  s4: {
    "flexShrink": 0,
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "12px",
    "paddingBottom": "10px",
  },
  s5: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "6px",
  },
  s6: {
    "maxWidth": "88rem",
  },
  s7: {
    "maxWidth": "72rem",
  },
  s8: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s10: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s11: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s12: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s13: {
    "width": "12px",
    "height": "12px",
  },
  s14: {
    "display": "flex",
    "minWidth": "0px",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "10px",
    "rowGap": "4px",
  },
  s15: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s16: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 600,
    "fontSize": "16px",
    "lineHeight": "24px",
  },
  s17: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "0.6875rem",
    "fontVariantNumeric": "tabular-nums",
  },
  s19: {
    "borderColor": "color-mix(in oklab, var(--info) 40%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "color": "var(--info-foreground)",
  },
  s20: {
    "color": "var(--muted-foreground)",
  },
  s21: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s22: {
    "backgroundColor": "var(--info)",
  },
  s23: {
    "display": "none",
  },
  s24: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "2px",
  },
  s25: {
    "fontSize": "0.8125rem",
  },
  s26: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--warning-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s28: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s29: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "4px",
    "paddingTop": "2px",
  },
  s30: {
    "marginInlineEnd": "2px",
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s31: {
    "display": "inline-flex",
    "minWidth": "0px",
    "maxWidth": "100%",
    "alignItems": "center",
    "gap": "6px",
    "whiteSpace": "nowrap",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "borderColor": "var(--ring)",
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s33: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s34: {
    "fontWeight": 500,
    "fontVariantNumeric": "tabular-nums",
  },
  s35: {
    "fontVariantNumeric": "tabular-nums",
  },
  s36: {
    "minWidth": "0px",
    "maxWidth": "14rem",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s37: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s38: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s39: {
    "width": "14px",
    "height": "14px",
    "color": "var(--warning-foreground)",
  },
  s40: {
    "marginLeft": "auto",
  },
  s41: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "auto",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s42: {
    "display": "flex",
    "flexDirection": "column",
    "padding": "16px",
  },
  s43: {
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "20px",
    "paddingBottom": "20px",
  },
  s44: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "width": "100%",
  },
  s45: {
    "maxWidth": "88rem",
  },
  s46: {
    "maxWidth": "72rem",
  },
  s47: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s48: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s49: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "0.6875rem",
    "fontVariantNumeric": "tabular-nums",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s50: {
    "borderColor": "color-mix(in oklab, var(--info) 40%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "color": "var(--info-foreground)",
  },
  s51: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s52: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s53: {
    "backgroundColor": "var(--info)",
  },
  s54: {
    "width": "12px",
    "height": "12px",
  },
  s55: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s56: {
    "fontWeight": 500,
    "fontVariantNumeric": "tabular-nums",
  },
  s57: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s58: {
    "minWidth": "0px",
    "maxWidth": "14rem",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  n0: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  n1: {
    "backgroundColor": "var(--info)",
  },
  n2: {
    "backgroundColor": "var(--success)",
  },
  n3: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  n4: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  n5: {
    "backgroundColor": "var(--info)",
  },
  n6: {
    "backgroundColor": "var(--success)",
  },
  n7: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },

  s59: {
    containerType: "inline-size",
    containerName: "art",
  },
  s60: {
    "@container art (max-width: 40rem)": {
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
    },
  },
  s61: {
    "@container art (max-width: 40rem)": {
      position: "absolute",
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      borderWidth: 0,
    },
  },
  s62: {
    "@container art (max-width: 40rem)": {
      flexWrap: "nowrap",
      columnGap: 6,
    },
  },
  s63: {
    "@container art (max-width: 40rem)": {
      fontSize: 14,
      lineHeight: "20px",
    },
  },
  s64: {
    "@container art (max-width: 40rem)": {
      display: "none",
    },
  },
  s65: {
    "@container art (max-width: 40rem)": {
      display: "inline-flex",
    },
  },
  s66: {
    ":not(#\\#) > *": {
      flex: "1 1 0%",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const Board = lazy(() => import("@/components/art/board"));
const SourceView = lazy(() => import("@/components/art/views/source-view"));

// ArtifactPane is an artifact as a tab, a pane of a split, or a side of
// Compare: who made it and from what, its headline, a Live pill that pulses
// when a version lands, its versions, its source, and the artifact itself
// at full size. Without an id it is the worktree's board.

export function ArtifactPane({ id, focus }: { id?: string; focus?: string }) {
  const pane = useContext(PaneContext);
  const wt = pane?.worktree;
  const art = useArtifact(id, wt);
  const loaded = useArt((s) => !!wt && wt in s.byWt);
  if (!id)
    return (
      <Suspense fallback={<div className={sx(paint.s0)} />}>
        <Board wt={wt} focus={focus} />
      </Suspense>
    );
  if (!art)
    return loaded ? (
      <div className={sx(paint.s1)} data-testid="artifact-pane">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>This artifact is gone</EmptyTitle>
            <EmptyDescription>Its worktree was archived, or it was removed with berthd artifact rm.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    ) : (
      <div className={[sx(paint.s2), "burf-pulse"].filter(Boolean).join(" ")} data-testid="artifact-pane" />
    );
  return <Shown art={art} />;
}

function madeBy(a: Art): string {
  const agent = a.by.agent === "codex" ? "Codex" : a.by.agent === "claude" || !a.by.agent ? "Claude" : a.by.agent;
  if (a.by.helper) return `${a.by.helper.replace(/^Explore:\s*/, "")}, a helper of ${agent}`;
  return a.by.session ? `${agent} (${a.by.session})` : agent;
}

function Shown({ art }: { art: Art }) {
  const pane = useContext(PaneContext);
  const pulse = usePulse(art.id);
  const [n, setN] = useState<number | null>(null);
  const [source, setSource] = useState(false);
  const cur = latest(art);
  const v = useMemo(() => art.versions.find((x) => x.n === n) ?? cur, [art.versions, n, cur]);
  const old = v.n !== cur.n;
  const kind = kindOf(art.kind);
  const { body } = useArtBody(art, v.n);
  useEffect(() => useArt.getState().seen(art.id), [art.id, cur.n]);
  const sandboxed = kind.drawn === "sandbox";
  const fill = art.kind !== "notes";
  // A compact kind's header, in a pane under 40rem (the pane is the
  // container): these classes apply there only (KindSpec.compact).
  const narrow = (cls: string) => (kind.compact ? cls : "");
  const pick = (n: number) => setN(n === cur.n ? null : n);

  return (
    <div data-testid="artifact-pane" data-art-id={art.id} className={[sx(paint.s3), kind.compact && sx(paint.s59)].filter(Boolean).join(" ")}>
      <header className={[sx(paint.s4), narrow(sx(paint.s60))].filter(Boolean).join(" ")} data-art-header>
        <div className={[sx(paint.s5), kind.wide ? sx(paint.s6) : sx(paint.s7)].filter(Boolean).join(" ")}>
          <div className={[sx(paint.s8), narrow(sx(paint.s61))].filter(Boolean).join(" ")}>
            <BotIcon className={sx(paint.s9)} aria-hidden />
            <span className={sx(paint.s10)}>Made by {madeBy(art)}</span>
            {art.file && (
              <>
                <span aria-hidden>·</span>
                <span className={sx(paint.s11)}>{art.file}</span>
              </>
            )}
            <Tip label={sandboxed ? "Runs on its own origin in a sandbox: no network, no access to Burf" : "Drawn by Burf from its data: no code of the agent's runs"}>
              <span className={sx(paint.s12)}>
                <LockIcon className={sx(paint.s13)} aria-hidden />
                {sandboxed ? "Sandboxed page" : (kind.drawnLabel ?? "Drawn by Burf")}
              </span>
            </Tip>
          </div>
          <div className={[sx(paint.s14), narrow(sx(paint.s62))].filter(Boolean).join(" ")}>
            <ArtGlyph art={art} body={body} className={sx(paint.s15)} />
            <h2 className={[sx(paint.s16), narrow(sx(paint.s63))].filter(Boolean).join(" ")}>{art.title}</h2>
            <span className={[sx(paint.s17), narrow(sx(paint.s64))].filter(Boolean).join(" ")}>
              <KindWord art={art} />
            </span>
            <span data-testid="art-live" data-pulse={pulse || undefined} className={[sx(paint.s18), pulse ? [sx(paint.s19), "art-pulse"].filter(Boolean).join(" ") : sx(paint.s20), narrow(sx(paint.s64))].filter(Boolean).join(" ")}>
              <span className={[sx(paint.n0), pulse ? [sx(paint.n1), "art-dot"].filter(Boolean).join(" ") : art.watched ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} aria-hidden />
              {pulse ? `Updated just now · v${cur.n}` : `${art.watched ? "Live" : "Latest"} · v${cur.n} · ${when(cur.at)}`}
            </span>
            {kind.compact && <VersionMenu art={art} cur={cur} v={v} pulse={pulse} onPick={pick} className={[sx(paint.s23), sx(paint.s65)].filter(Boolean).join(" ")} />}
            <span className={sx(paint.s24)}>
              <Tip label={source ? "Show the artifact" : "Show its source"}>
                <Button size="xs" variant={source ? "secondary" : "ghost"}  onClick={() => setSource((s) => !s)} aria-pressed={source} data-testid="art-source-toggle" muted>
                  {source ? <EyeIcon /> : <CodeIcon />}
                  <span className={narrow(sx(paint.s61))}>{source ? "Artifact" : "Source"}</span>
                </Button>
              </Tip>
              <Tip label="All of this worktree's artifacts">
                <Button size="xs" variant="ghost"  onClick={() => pane && openBoard(pane.worktree, { focus: art.id })} data-testid="art-board-link" muted>
                  <LayoutGridIcon />
                  <span className={narrow(sx(paint.s61))}>Board</span>
                </Button>
              </Tip>
            </span>
          </div>
          <GistLine art={art} className={[sx(paint.s25), narrow(sx(paint.s61))].filter(Boolean).join(" ")} />
          {art.problem && (
            <div className={sx(paint.s26)}>
              <TriangleAlertIcon className={sx(paint.s27)} aria-hidden />
              <span className={sx(paint.s28)}>The latest rewrite of {art.file ?? "its file"} wasn't taken: {art.problem}</span>
            </div>
          )}
          {art.versions.length > 1 && (
            <div className={[sx(paint.s29), narrow(sx(paint.s64))].filter(Boolean).join(" ")} role="radiogroup" aria-label="Versions" data-testid="art-versions">
              <HistoryIcon className={sx(paint.s30)} aria-hidden />
              {[...art.versions].reverse().map((x) => (
                <button
                  key={x.n}
                  type="button"
                  role="radio"
                  aria-checked={x.n === v.n}
                  onClick={() => pick(x.n)}
                  className={[sx(paint.s31), x.n === v.n ? sx(paint.s32) : sx(paint.s33)].filter(Boolean).join(" ")}
                >
                  <span className={sx(paint.s34)}>v{x.n}</span>
                  <span className={sx(paint.s35)}>{x.n === cur.n ? "latest" : when(x.at)}</span>
                  {x.note && <span className={sx(paint.s36)}>· {x.note}</span>}
                  <span className={sx(paint.s37)}>· {sizeLabel(x.size)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {old && (
        <div className={sx(paint.s38)} data-testid="art-old">
          <HistoryIcon className={sx(paint.s39)} aria-hidden />
          <span>
            Showing v{v.n} from {when(v.at)}. The latest is v{cur.n}.
          </span>
          <span className={sx(paint.s40)}><Button size="xs" variant="outline"  onClick={() => setN(null)}>
            Back to latest
          </Button></span>
        </div>
      )}
      {/* Focusable, so the keyboard can scroll it when nothing in it takes
          focus (a long source, notes). */}
      <div tabIndex={0} aria-label={art.title} role="region" className={[sx(paint.s41), fill || source ? sx(paint.s42) : sx(paint.s43)].filter(Boolean).join(" ")}>
        <div className={[sx(paint.s44), kind.wide ? sx(paint.s45) : sx(paint.s46), (fill || source) && sx(paint.s47)].filter(Boolean).join(" ")}>
          {source ? (
            body === undefined ? null : (
              <Suspense fallback={null}>
                <div data-testid="art-source">
                  <SourceView art={art} version={v} body={body} size="full" />
                </div>
              </Suspense>
            )
          ) : (
            <ArtView art={art} version={v} size="full" className={fill ? [sx(paint.s48), sx(paint.s66)].filter(Boolean).join(" ") : undefined} />
          )}
        </div>
      </div>
    </div>
  );
}

// VersionMenu is a compact header's Live pill and versions strip in one:
// the version shown, which opens the list of them.
function VersionMenu({ art, cur, v, pulse, onPick, className }: { art: Art; cur: ArtVersion; v: ArtVersion; pulse: boolean; onPick(n: number): void; className?: string }) {
  const state = pulse ? "Updated just now" : art.watched ? "Live" : "Latest";
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={`Version: v${v.n}${v.n === cur.n ? `, the latest (${state.toLowerCase()})` : `, the latest is v${cur.n}`}. ${art.versions.length} ${art.versions.length === 1 ? "version" : "versions"}`}
            data-testid="art-version-menu"
            data-pulse={pulse || undefined}
            className={[sx(paint.s49), pulse ? [sx(paint.s50), "art-pulse"].filter(Boolean).join(" ") : sx(paint.s51), className].filter(Boolean).join(" ")}
          />
        }
      >
        <span className={[sx(paint.n4), pulse ? [sx(paint.n5), "art-dot"].filter(Boolean).join(" ") : art.watched ? sx(paint.n6) : sx(paint.n7)].filter(Boolean).join(" ")} aria-hidden />
        v{v.n}
        <ChevronDownIcon className={sx(paint.s54)} aria-hidden />
      </MenuTrigger>
      <MenuPopup align="start" width={menuWidths.w56}>
        <MenuGroup>
          <MenuGroupLabel>
            {state} · v{cur.n} · {when(cur.at)}
          </MenuGroupLabel>
          <MenuRadioGroup value={String(v.n)} onValueChange={(x) => onPick(Number(x))}>
            {[...art.versions].reverse().map((x) => (
              <MenuRadioItem key={x.n} value={String(x.n)}>
                <span className={sx(paint.s55)}>
                  <span className={sx(paint.s56)}>v{x.n}</span>
                  <span className={sx(paint.s57)}>{x.n === cur.n ? "latest" : when(x.at)}</span>
                  {x.note && <span className={sx(paint.s58)}>· {x.note}</span>}
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
