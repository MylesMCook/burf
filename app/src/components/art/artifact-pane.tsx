import "./art.css";

import { BotIcon, CodeIcon, EyeIcon, HistoryIcon, LayoutGridIcon, LockIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { lazy, Suspense, useContext, useEffect, useMemo, useState } from "react";

import { ArtGlyph, GistLine, KindWord, usePulse, when } from "@/components/art/art-card";
import { ArtView } from "@/components/art/art-view";
import { kindOf } from "@/components/art/kinds";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { type Art, latest, sizeLabel, useArt, useArtBody, useArtifact } from "@/lib/art/model";
import { openBoard } from "@/lib/art/open";
import { PaneContext } from "@/lib/pane-context";
import { cn } from "@/lib/utils";

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
      <Suspense fallback={<div className="flex-1" />}>
        <Board wt={wt} focus={focus} />
      </Suspense>
    );
  if (!art)
    return loaded ? (
      <div className="flex flex-1 items-center justify-center p-6" data-testid="artifact-pane">
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
      <div className="flex-1 animate-pulse bg-muted/20" data-testid="artifact-pane" />
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

  return (
    <div data-testid="artifact-pane" data-art-id={art.id} className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="shrink-0 border-b px-5 pt-3 pb-2.5">
        <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
            <BotIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">Made by {madeBy(art)}</span>
            {art.file && (
              <>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate font-mono">{art.file}</span>
              </>
            )}
            <Tip label={sandboxed ? "Runs on its own origin in a sandbox: no network, no access to Berth" : "Drawn by Berth from its data: no code of the agent's runs"}>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                <LockIcon className="size-3" aria-hidden />
                {sandboxed ? "Sandboxed page" : "Drawn by Berth"}
              </span>
            </Tip>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <ArtGlyph art={art} body={body} className="size-4 text-muted-foreground" />
            <h2 className="min-w-0 truncate font-semibold text-base">{art.title}</h2>
            <span className="shrink-0 text-muted-foreground text-xs">
              <KindWord art={art} />
            </span>
            <span data-testid="art-live" data-pulse={pulse || undefined} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] tabular-nums", pulse ? "art-pulse border-info/40 bg-info/10 text-info-foreground" : "text-muted-foreground")}>
              <span className={cn("size-1.5 rounded-full", pulse ? "art-dot bg-info" : art.watched ? "bg-success" : "bg-muted-foreground/60")} aria-hidden />
              {pulse ? `Updated just now · v${cur.n}` : `${art.watched ? "Live" : "Latest"} · v${cur.n} · ${when(cur.at)}`}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-0.5">
              <Tip label={source ? "Show the artifact" : "Show its source"}>
                <Button size="xs" variant={source ? "secondary" : "ghost"} className="text-muted-foreground" onClick={() => setSource((s) => !s)} aria-pressed={source} data-testid="art-source-toggle">
                  {source ? <EyeIcon /> : <CodeIcon />}
                  {source ? "Artifact" : "Source"}
                </Button>
              </Tip>
              <Tip label="All of this worktree's artifacts">
                <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => pane && openBoard(pane.worktree, { focus: art.id })} data-testid="art-board-link">
                  <LayoutGridIcon />
                  Board
                </Button>
              </Tip>
            </span>
          </div>
          <GistLine art={art} className="text-[0.8125rem]" />
          {art.problem && (
            <div className="flex items-center gap-1.5 text-warning-foreground text-xs">
              <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">The latest rewrite of {art.file ?? "its file"} wasn't taken: {art.problem}</span>
            </div>
          )}
          {art.versions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5" role="radiogroup" aria-label="Versions" data-testid="art-versions">
              <HistoryIcon className="me-0.5 size-3.5 text-muted-foreground" aria-hidden />
              {[...art.versions].reverse().map((x) => (
                <button
                  key={x.n}
                  type="button"
                  role="radio"
                  aria-checked={x.n === v.n}
                  onClick={() => setN(x.n === cur.n ? null : x.n)}
                  className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs", x.n === v.n ? "border-ring bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60")}
                >
                  <span className="font-medium tabular-nums">v{x.n}</span>
                  <span className="tabular-nums">{x.n === cur.n ? "latest" : when(x.at)}</span>
                  {x.note && <span className="max-w-[14rem] truncate">· {x.note}</span>}
                  <span className="text-muted-foreground/70 tabular-nums">· {sizeLabel(x.size)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {old && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-warning/8 px-5 py-1.5 text-xs" data-testid="art-old">
          <HistoryIcon className="size-3.5 text-warning-foreground" aria-hidden />
          <span>
            Showing v{v.n} from {when(v.at)}. The latest is v{cur.n}.
          </span>
          <Button size="xs" variant="outline" className="ml-auto" onClick={() => setN(null)}>
            Back to latest
          </Button>
        </div>
      )}
      <div className={cn("min-h-0 flex-1 overflow-auto", fill || source ? "flex flex-col p-4" : "px-5 py-5")}>
        <div className={cn("mx-auto w-full max-w-[72rem]", (fill || source) && "flex min-h-0 flex-1 flex-col")}>
          {source ? (
            body === undefined ? null : (
              <Suspense fallback={null}>
                <div data-testid="art-source">
                  <SourceView art={art} version={v} body={body} size="full" />
                </div>
              </Suspense>
            )
          ) : (
            <ArtView art={art} version={v} size="full" className={cn(fill && "flex min-h-0 flex-1 flex-col *:flex-1")} />
          )}
        </div>
      </div>
    </div>
  );
}
