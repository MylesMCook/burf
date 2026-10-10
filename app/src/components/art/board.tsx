import * as stylex from "@stylexjs/stylex";
import "./art.css";

import { ArrowUpRightIcon, LayoutGridIcon, PanelRightIcon } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

import { ArtGlyph, artTime, GistLine, KindChips, KindWord, Press, usePulse, when } from "@/components/art/art-card";
import { ArtView } from "@/components/art/art-view";
import { allKinds } from "@/components/art/kinds";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { type Art, latest, useArt, useWorktreeArt } from "@/lib/art/model";
import { openArtifact } from "@/lib/art/open";
import { PaneContext } from "@/lib/pane-context";
import { useWorktreeRef } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "overflow": "auto",
    "backgroundColor": "var(--background)",
  },
  s1: {
    "position": "sticky",
    "top": "0px",
    "zIndex": 10,
    "flexShrink": 0,
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--background) 95%, transparent)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "12px",
    "paddingBottom": "10px",
  },
  s2: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "100%",
    "maxWidth": "80rem",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "8px",
  },
  s3: {
    "width": "16px",
    "height": "16px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "fontWeight": 600,
    "fontSize": "16px",
    "lineHeight": "24px",
  },
  s5: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "marginLeft": "auto",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "4px",
  },
  s7: {
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
  s8: {
    "borderColor": "transparent",
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s9: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s10: {
    "marginInlineStart": "4px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "24px",
  },
  s12: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "grid",
    "width": "100%",
    "maxWidth": "80rem",
    "gridTemplateColumns": "repeat(auto-fill,minmax(16rem,1fr))",
    "gap": "12px",
    "padding": "20px",
  },
  s13: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 50%, transparent)",
    },
    "backgroundColor": "var(--card)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s14: {
    "gridColumn": "1 / -1",
    "boxShadow": "0 0 0 2px color-mix(in oklab, var(--ring) 40%, transparent)",
  },
  s15: {
    "borderColor": "color-mix(in oklab, var(--info) 50%, transparent)",
  },
  s16: {
    "position": "relative",
    "display": "block",
    "overflow": "hidden",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "textAlign": "left",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s17: {
    "padding": "16px",
  },
  s18: {
    "padding": "10px",
  },
  s19: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s20: {
    "color": "var(--muted-foreground)",
  },
  s21: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s22: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "0.8125rem",
  },
  s23: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "paddingTop": "2px",
    "paddingBottom": "2px",
  },
  s25: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s27: {
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s28: {
    "fontWeight": 500,
    "color": "var(--info-foreground)",
  },
  s29: {
    "marginInlineEnd": "4px",
    "display": "inline-block",
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--info)",
    "verticalAlign": "middle",
  },
  s30: {
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    ":is(.group:hover &)": {
      "opacity": 1,
    },
  },

  s31: {
    backdropFilter: "blur(8px)",
  },
  s32: {
    containerType: "inline-size",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The board: a worktree's artifacts at a glance, a grid of live
// thumbnails, the newest change first, filtered by kind. focus leads,
// larger. Opened from the chat's "N artifacts" chip, a tab's Board button,
// or the worktree's toolbar.

export default function Board({ wt, focus }: { wt?: string; focus?: string }) {
  const list = useWorktreeArt(wt);
  const loaded = useArt((s) => !!wt && wt in s.byWt);
  const ref = useWorktreeRef(wt);
  const [filter, setFilter] = useState<string>("all");
  const kinds = allKinds().filter((k) => list.some((a) => a.kind === k.kind));
  const rows = useMemo(() => list.filter((a) => filter === "all" || a.kind === filter).sort((x, y) => artTime(y) - artTime(x)), [list, filter]);
  const lead = focus ? rows.find((a) => a.id === focus) : undefined;
  const rest = rows.filter((a) => a !== lead);
  return (
    <div data-testid="artifact-board" className={sx(paint.s0)}>
      <header className={[sx(paint.s1), sx(paint.s31)].filter(Boolean).join(" ")}>
        <div className={sx(paint.s2)}>
          <LayoutGridIcon className={sx(paint.s3)} aria-hidden />
          <h2 className={sx(paint.s4)}>Artifacts</h2>
          <span className={sx(paint.s5)}>
            {ref ? (ref.main ? ref.location : ref.worktree) : ""}
            {list.length ? ` · ${list.length} made by its agents · live` : ""}
          </span>
          {kinds.length > 0 && (
            <div className={sx(paint.s6)} role="toolbar" aria-label="Show">
              {[{ kind: "all", plural: "All" }, ...kinds].map((k) => (
                <button key={k.kind} type="button" aria-pressed={filter === k.kind} data-filter={k.kind} onClick={() => setFilter(k.kind)} className={[sx(paint.s7), filter === k.kind ? sx(paint.s8) : sx(paint.s9)].filter(Boolean).join(" ")}>
                  {k.plural}
                  {k.kind !== "all" && <span className={sx(paint.s10)}>{list.filter((a) => a.kind === k.kind).length}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {loaded && !list.length ? (
        <div className={sx(paint.s11)}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGridIcon />
              </EmptyMedia>
              <EmptyTitle>No artifacts here yet</EmptyTitle>
              <EmptyDescription>When an agent in this worktree makes a chart, a table, a diagram, notes or a small page with berthd artifact add, it shows here, live.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className={sx(paint.s12)}>
          {lead && <Tile art={lead} lead />}
          {rest.map((a) => (
            <Tile key={a.id} art={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ art, lead }: { art: Art; lead?: boolean }) {
  const pulse = usePulse(art.id);
  const pane = useContext(PaneContext);
  const from = pane ? { wsKey: pane.wsKey, tab: pane.tab, pane: pane.pane } : undefined;
  const v = latest(art);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lead) ref.current?.scrollIntoView({ block: "nearest" });
  }, [lead]);
  const open = (split: boolean) => openArtifact(art, { split, from });
  return (
    <div ref={ref} data-art-tile={art.id} className={[[sx(paint.s13), [sx(paint.s32), "group"].filter(Boolean).join(" ")].filter(Boolean).join(" "), lead && sx(paint.s14), pulse && [sx(paint.s15), "art-pulse"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
      <Press onPress={(e) => open(e.metaKey || e.ctrlKey)} className={[sx(paint.s16), lead ? sx(paint.s17) : sx(paint.s18)].filter(Boolean).join(" ")} label={`Open ${art.title}`}>
        <ArtView art={art} size="thumb" height={lead ? 300 : 136} />
      </Press>
      <div className={sx(paint.s19)}>
        <ArtGlyph art={art} className={sx(paint.s20)} />
        <div className={sx(paint.s21)}>
          <div className={sx(paint.s22)}>{art.title}</div>
          <GistLine art={art} className={sx(paint.s23)} />
          {lead && <KindChips art={art} className={sx(paint.s24)} />}
          <div className={sx(paint.s25)}>
            <span className={sx(paint.s26)}>
              <KindWord art={art} />
            </span>
            <span aria-hidden>·</span>
            <span className={[sx(paint.s27), pulse && sx(paint.s28)].filter(Boolean).join(" ")}>
              {pulse && <span className={[sx(paint.s29), "art-dot"].filter(Boolean).join(" ")} aria-hidden />}v{v.n} · {pulse ? "just now" : when(v.at)}
            </span>
          </div>
        </div>
        <Tip label="Open beside">
          <span className={sx(paint.s30)}><Button size="icon-xs" variant="ghost"  aria-label={`Open ${art.title} beside`} onClick={() => open(true)} muted>
            <PanelRightIcon />
          </Button></span>
        </Tip>
        <Tip label="Open in a tab">
          <Button size="icon-xs" variant="ghost"  aria-label={`Open ${art.title}`} onClick={() => open(false)} muted>
            <ArrowUpRightIcon />
          </Button>
        </Tip>
      </div>
    </div>
  );
}
