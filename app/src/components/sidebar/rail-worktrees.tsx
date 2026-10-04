import { EllipsisIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { StateGlyph, stateText } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type { Location, Session, Worktree } from "@/lib/api";
import { agentOf, type SessionState, sessionState, worktreeSessions } from "@/lib/derive";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { refOf, selectWorktree, useWorkspaces, wsKey } from "@/lib/workspaces";

// The most tiles a rail shows, however tall the window; the rest are in the
// "more" tile's menu.
const MAX = 8;
// A tile is 32px with a 6px gap; the list starts 19px down (margin, rule,
// padding).
const TILE = 38;
const TOP = 19;

const urgency: Record<SessionState, number> = { waiting: 0, running: 1, finished: 2, ready: 3, idle: 4, exited: 5 };

interface Entry {
  key: string;
  box: string;
  loc: Location;
  wt: Worktree;
  state?: SessionState;
  agent?: string;
  selected: boolean;
  // The box is not online: the tile stays, dimmed, as the sidebar's row does.
  away?: string;
}

// monogram is a worktree's two letters on the rail: "checkout-fix" is CF,
// "qa" is QA, a main checkout is its project's.
export function monogram(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter((w) => w && !/^\d+$/.test(w));
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2);
  return letters.toUpperCase();
}

// Ready and idle say nothing in a tile's corner.
const marked = (s?: SessionState): s is "running" | "waiting" | "finished" => s === "running" || s === "waiting" || s === "finished";

function label(e: Entry) {
  const name = e.wt.main ? `${e.loc.name} main checkout` : `${e.loc.name} / ${e.wt.name}`;
  if (e.away) return `${name} · ${e.box} is ${e.away}`;
  const state = e.state && e.state !== "idle" ? stateText(e.state) : undefined;
  return `${name} · ${e.box}${state ? ` · ${state.toLowerCase()}` : ""}`;
}

// RailWorktrees are the active worktrees in the folded sidebar: those with
// a session running and the one open, most urgent first, so switching
// worktree does not need the sidebar back. Each is a lettered tile with the
// state glyph the sidebar uses in its corner. A box that goes offline keeps
// its tiles, dimmed. When the window is too short for them all, the last
// tile becomes a menu of the rest, and the open worktree always has a tile.
export function RailWorktrees() {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const current = useWorkspaces((s) => s.current);
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const root = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(MAX);

  useEffect(() => {
    const el = root.current?.parentElement;
    if (!el) return;
    const measure = () => setFit(Math.max(1, Math.min(MAX, Math.floor((el.clientHeight - TOP + 6) / TILE))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const b of boxes) {
      const away = b.state === "online" ? undefined : b.state === "untrusted" ? "not trusted" : b.state;
      const d = data[b.name];
      for (const loc of d?.locations ?? []) {
        for (const wt of loc.worktrees ?? []) {
          const key = wsKey(b.name, wt.path);
          const live = worktreeSessions(d?.sessions, wt).filter((s) => !s.exited);
          const selected = inWorkspace && current === key;
          if (!live.length && !selected) continue;
          // What an offline box last said is stale; its tile shows no state.
          const ranked = away ? [] : live.map((s): [Session, SessionState] => [s, sessionState(s, d?.stats)]).sort((x, y) => urgency[x[1]] - urgency[y[1]]);
          const lead = ranked.find(([s]) => agentOf(s)) ?? ranked[0];
          out.push({ key, box: b.name, loc, wt, state: ranked[0]?.[1], agent: lead && agentOf(lead[0]), selected, away });
        }
      }
    }
    out.sort((x, y) => Number(!!x.away) - Number(!!y.away) || urgency[x.state ?? "idle"] - urgency[y.state ?? "idle"] || x.loc.name.localeCompare(y.loc.name) || x.wt.name.localeCompare(y.wt.name));
    return out;
  }, [boxes, data, current, inWorkspace]);

  // Tiles that fit, the last one a menu when some do not; the open worktree
  // takes the last tile's place rather than going into the menu.
  const overflow = entries.length > fit;
  let tiles = overflow ? entries.slice(0, fit - 1) : entries;
  let rest = overflow ? entries.slice(fit - 1) : [];
  const open = rest.find((e) => e.selected);
  if (open) {
    if (tiles.length) {
      rest = [tiles[tiles.length - 1], ...rest.filter((e) => e !== open)];
      tiles = [...tiles.slice(0, -1), open];
    } else {
      tiles = [open];
      rest = rest.filter((e) => e !== open);
    }
  }

  return (
    <div ref={root}>
      {entries.length > 0 && (
        <div className="mt-2 flex flex-col items-center gap-1.5 border-sidebar-border border-t pt-2.5">
          {tiles.map((e) => (
            <Tile key={e.key} e={e} />
          ))}
          {rest.length > 0 && <More entries={rest} />}
        </div>
      )}
    </div>
  );
}

function Tile({ e }: { e: Entry }) {
  const text = label(e);
  return (
    <Tip label={text} side="right">
      <button
        type="button"
        aria-label={text}
        aria-current={e.selected || undefined}
        onClick={() => selectWorktree(refOf(e.box, e.loc, e.wt))}
        className={cn(
          "relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/40 font-medium text-[11px] text-muted-foreground tracking-wide outline-none hover:border-ring/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          e.selected && "border-foreground/25 bg-sidebar-accent text-foreground",
          e.away && "border-dashed text-muted-foreground/60",
        )}
      >
        <span className={cn(e.away && "opacity-60")}>{monogram(e.wt.main ? e.loc.name : e.wt.name)}</span>
        {e.away ? (
          <span aria-hidden className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-sidebar">
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          </span>
        ) : (
          marked(e.state) && (
            <span aria-hidden className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-sidebar">
              <StateGlyph state={e.state} className="size-3" />
            </span>
          )
        )}
      </button>
    </Tip>
  );
}

// More is the last tile when the rail is too short: a menu of the rest,
// marked when any of them needs you.
function More({ entries }: { entries: Entry[] }) {
  const urgent = entries.find((e) => !e.away && marked(e.state) && e.state === "waiting");
  const text = `${entries.length} more ${entries.length === 1 ? "worktree" : "worktrees"}`;
  return (
    <Menu>
      <Tip label={text} side="right">
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={text}
              className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border border-dashed text-muted-foreground outline-none hover:border-ring/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-sidebar-accent"
            />
          }
        >
          <EllipsisIcon className="size-4" />
          <span className="sr-only">{text}</span>
          {urgent && (
            <span aria-hidden className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-sidebar">
              <StateGlyph state="waiting" className="size-3" />
            </span>
          )}
        </MenuTrigger>
      </Tip>
      <MenuPopup side="right" align="end" className="min-w-56">
        {entries.map((e) => (
          <MenuItem key={e.key} onClick={() => selectWorktree(refOf(e.box, e.loc, e.wt))} className={cn(e.away && "text-muted-foreground")}>
            <span className="flex size-4 items-center justify-center">
              {e.away ? <span className="size-1.5 rounded-full bg-muted-foreground/50" /> : marked(e.state) ? <StateGlyph state={e.state} className="size-3.5" /> : null}
            </span>
            <span className="truncate">{e.wt.main ? e.loc.name : `${e.loc.name} / ${e.wt.name}`}</span>
            <span className="ml-auto pl-3 text-muted-foreground text-xs">{e.away ? `${e.box} · ${e.away}` : e.box}</span>
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
