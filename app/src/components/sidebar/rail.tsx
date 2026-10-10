import * as stylex from "@stylexjs/stylex";
import { ChevronRightIcon, PencilIcon, ServerOffIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { ContextRow } from "@/components/sidebar/actions";
import { openRenameWorktree } from "@/components/sidebar/rename-worktree";
import { RowLayer } from "@/components/sidebar/row-layer";
import { Tip } from "@/components/tip";
import { useTones } from "@/components/workspace/worktree-tone";
import type { Location, Session, Worktree } from "@/lib/api";
import { agentLabel, agentOf, type SessionState, sessionState } from "@/lib/derive";
import { ago } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { useProjects } from "@/lib/project-groups";
import { load, save } from "@/lib/storage";
import { BOX_WORDS, boxState, sessionWord } from "@/lib/state-model";
import { NONE, useStore } from "@/lib/store";
import { toneVar } from "@/lib/groups";
import { addGroup, openSession, useWorkspaces, wsKey } from "@/lib/workspaces";
import { renameWorktree, worktreeLabel } from "@/lib/worktree-names";

const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "256px",
    "flexDirection": "column",
    "gap": "4px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
  },
  s2: {
    "width": "14px",
    "height": "14px",
  },
  s3: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s4: {
    "width": "12px",
    "height": "12px",
  },
  s5: {
    "width": "12px",
    "height": "12px",
  },
  s6: {
    "color": "var(--warning-foreground)",
  },
  s7: {
    "color": "var(--info-foreground)",
  },
  s8: {
    "color": "var(--success-foreground)",
  },
  s9: {
    "fontWeight": 500,
    "fontSize": "13px",
    "color": "var(--foreground)",
    "lineHeight": "1.375",
  },
  s10: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "overflowWrap": "break-word",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s11: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s13: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s14: {
    "marginLeft": "auto",
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s15: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
  },
  s17: {
    "color": "var(--muted-foreground)",
  },
  ring: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": "-3px",
    "right": "-3px",
    "bottom": "-3px",
    "left": "-3px",
    "borderRadius": "999px",
  },
  s19: {
    "borderWidth": "1.5px",
    "borderStyle": "dashed",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  s20: {
    "borderWidth": 2,
    "borderStyle": "solid",
    "borderColor": "var(--info)",
    "borderTopColor": "transparent",
    "borderRightColor": "transparent",
    "animationName": spin,
    "animationDuration": "1.4s",
    "animationTimingFunction": "linear",
    "animationIterationCount": "infinite",
    "@media (prefers-reduced-motion: reduce)": {
      "animationName": "none",
    },
    ":is(:root[data-berth-still] &)": {
      "animationName": "none",
    },
  },
  s21: {
    "borderWidth": 2,
    "borderStyle": "solid",
    "borderColor": "var(--warning)",
  },
  s22: {
    "borderWidth": "1.5px",
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--success) 70%, transparent)",
  },
  s23: {
    "width": "16px",
    "height": "16px",
  },
  s24: {
    "position": "relative",
  },
  s25: {
    "position": "absolute",
    "top": "8px",
    "left": "-4px",
    "height": "20px",
    "width": "3px",
    "borderTopRightRadius": "999px",
    "borderBottomRightRadius": "999px",
  },
  s26: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "2px",
    "paddingRight": "2px",
    "paddingTop": "6px",
    "paddingBottom": "4px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--sidebar-accent) 60%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s27: {
    "position": "relative",
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "var(--sidebar-accent)",
  },
  s28: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 12%, transparent)",
  },
  s29: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s30: {
    "opacity": 0.6,
  },
  s31: {
    "width": "14px",
    "height": "14px",
  },
  s32: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "width": "100%",
    "textAlign": "center",
    "fontSize": "10px",
    "lineHeight": "11px",
    "overflowWrap": "anywhere",
  },
  s33: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s34: {
    "color": "var(--muted-foreground)",
    ":is(.group:hover &)": {
      "color": "var(--foreground)",
    },
  },
  s35: {
    "opacity": 0.7,
  },
  s36: {
    "position": "sticky",
    "top": "0px",
    "zIndex": 10,
    "display": "flex",
    "height": "24px",
    "width": "100%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": {
      "default": "var(--sidebar)",
      ":hover": "var(--sidebar-accent)",
    },
    "fontWeight": 500,
    "fontSize": "10px",
    "fontVariantNumeric": "tabular-nums",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s37: {
    "width": "12px",
    "height": "12px",
    "color": "var(--muted-foreground)",
  },
  s38: {
    "width": "12px",
    "height": "12px",
  },
  s39: {
    "color": "var(--warning-foreground)",
  },
  s40: {
    "color": "var(--muted-foreground)",
  },
  s41: {
    "marginRight": "calc(4px * -1)",
    "width": "12px",
    "height": "12px",
    "color": "var(--muted-foreground)",
  },
  s42: {
    "height": "100%",
    "borderColor": "var(--sidebar-border)",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--sidebar-border)",
    "paddingTop": "4px",
  },
  s43: {
    "paddingBottom": "4px",
  },
  s44: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// ---- What the rail knows -------------------------------------------------

export type Lane = "waiting" | "running" | "finished" | "away";
export const LANES: Lane[] = ["waiting", "running", "finished", "away"];

export interface RailAgent {
  id: string;
  box: string;
  loc: Location;
  wt: Worktree;
  project: string;
  session: Session;
  state: SessionState;
  lane: Lane;
  agent: string;
  key: string;
  selected: boolean;
  tone?: string;
  // The box's state when it is not online: what it ran is last seen.
  away?: string;
}

const LANE_WORDS: Record<Lane, string> = { waiting: "Needs you", running: "Working", finished: "Done", away: "Box away" };

// useRailAgents is every agent worth a glance: one that needs you, is
// working or is done, on every box, and the ones on a box that went away.
// Idle agents and plain shells say nothing, so the rail stays quiet.
export function useRailAgents(): RailAgent[] {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const current = useWorkspaces((s) => s.current);
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const { projects } = useProjects();
  const tones = useTones();
  return useMemo(() => {
    const projectOf = new Map<string, string>();
    for (const p of projects) for (const m of p.members) projectOf.set(`${m.box.name}/${m.loc.name}`, p.name);
    const out: RailAgent[] = [];
    for (const b of boxes) {
      const d = data[b.name];
      const away = b.state === "online" ? undefined : BOX_WORDS[boxState(b, d)].lower;
      for (const loc of d?.locations ?? []) {
        for (const wt of loc.worktrees ?? []) {
          for (const s of d?.sessions ?? []) {
            if (s.dir !== wt.path || s.service || s.exited) continue;
            const agent = agentOf(s);
            if (!agent) continue;
            const state = sessionState(s, d?.stats);
            const lane: Lane | undefined = away ? "away" : state === "waiting" || state === "running" || state === "finished" ? state : undefined;
            if (!lane) continue;
            const key = wsKey(b.name, wt.path);
            out.push({
              id: `${b.name}/${s.name}`,
              box: b.name,
              loc,
              wt,
              project: projectOf.get(`${b.name}/${loc.name}`) ?? loc.name,
              session: s,
              state,
              lane,
              agent,
              key,
              selected: inWorkspace && current === key,
              tone: tones[key] ? toneVar(tones[key]) : undefined,
              away,
            });
          }
        }
      }
    }
    // Lanes in order, and inside one by place, so a tile only moves when
    // its agent changes state.
    const order = (e: RailAgent) => LANES.indexOf(e.lane);
    return out.sort((x, y) => order(x) - order(y) || x.project.localeCompare(y.project) || worktreeLabel(x.wt).localeCompare(worktreeLabel(y.wt)) || x.box.localeCompare(y.box) || x.session.name.localeCompare(y.session.name));
  }, [boxes, data, current, inWorkspace, projects, tones]);
}

// A worktree by its display name, when it was given one (lib/worktree-names).
const wtName = (e: Pick<RailAgent, "wt" | "loc">) => worktreeLabel(e.wt, e.loc);
const place = (e: RailAgent) => (e.wt.main ? `${e.project}` : `${e.project} / ${worktreeLabel(e.wt)}`);

function focus(e: RailAgent, alt = false) {
  if (alt && usePrefs.getState().labs) return void addGroup(e.key);
  openSession(e.box, e.session);
}

// label is a tile's name for screen readers: what, where, and its state.
function label(e: RailAgent) {
  const what = e.session.title ? `: ${e.session.title}` : "";
  if (e.away) return `${agentLabel(e.agent)} in ${place(e)} on ${e.box}${what}. ${e.box} is ${e.away}`;
  return `${agentLabel(e.agent)} in ${place(e)} on ${e.box}${what}. ${sessionWord(e.state)}`;
}

// AgentCard is the hover card: the agent, its state and for how long, what
// it works on, what it waits for, and where it is.
export function AgentCard({ e }: { e: RailAgent }) {
  const since = e.session.state_since ? ago(e.session.state_since).replace(" ago", "") : "";
  const ask = e.state === "waiting" && !e.away ? e.session.ask : undefined;
  return (
    <span data-testid="rail-card" className={sx(paint.s0)}>
      <span className={sx(paint.s1)}>
        <AgentIcon agent={e.agent} className={sx(paint.s2)} />
        <span>{agentLabel(e.agent)}</span>
        <span className={sx(paint.s3)}>
          {e.away ? (
            <>
              <ServerOffIcon className={sx(paint.s4)} />
              {e.box} {e.away}
            </>
          ) : (
            <>
              <StateGlyph state={e.state} className={sx(paint.s5)} />
              <span className={[e.state === "waiting" && sx(paint.s6), e.state === "running" && sx(paint.s7), e.state === "finished" && sx(paint.s8)].filter(Boolean).join(" ")}>{sessionWord(e.state)}</span>
              {since && <span>· {since}</span>}
            </>
          )}
        </span>
      </span>
      <span className={sx(paint.s9)}>{e.session.title ?? (e.wt.main ? "Main checkout" : worktreeLabel(e.wt))}</span>
      {ask && (ask.input || ask.message) && (
        <span className={sx(paint.s10)}>
          {ask.tool ? `${ask.tool}: ` : ""}
          {ask.input ?? ask.message}
        </span>
      )}
      <span className={sx(paint.s11)}>
        {e.tone && <span aria-hidden className={sx(paint.s12)} style={{ background: e.tone }} />}
        <span className={sx(paint.s13)}>{e.wt.main ? `${e.project} · main checkout` : place(e)}</span>
        <span className={sx(paint.s14)}>{e.box}</span>
      </span>
      {/* A renamed worktree's own name, which its branch and folder keep. */}
      {!e.wt.main && e.wt.title && <span className={sx(paint.s15)}>{e.wt.name}</span>}
      {!e.wt.main && !e.away && <span className={sx(paint.s16)}>Right-click or F2 to rename the worktree</span>}
      {e.away && <span className={sx(paint.s17)}>Last seen {sessionWord(e.state, true)}. It may have moved on.</span>}
    </span>
  );
}

// useRoving gives a list one tab stop and arrow keys between its items.
function useRoving() {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (ev: KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[data-rail-item]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[ev.key];
    if (to === undefined) return;
    ev.preventDefault();
    const next = items[Math.max(0, Math.min(items.length - 1, to))];
    for (const it of items) it.tabIndex = it === next ? 0 : -1;
    next.focus();
  };
  // The first item is the tab stop until arrows move it.
  useEffect(() => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[data-rail-item]") ?? [])];
    if (items.length && !items.some((it) => it.tabIndex === 0)) items[0].tabIndex = 0;
  });
  return { ref, onKeyDown };
}

// Scroller is the rail's middle: it scrolls when there is more than fits,
// with a fade at an edge there is more past.
function Scroller({ children, label: name }: { children: ReactNode; label: string }) {
  const roving = useRoving();
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const update = () => {
    const el = roving.ref.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setEdges((e) => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
  };
  // Its own size, and what is in it, change what is past an edge.
  useEffect(() => {
    const el = roving.ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    update();
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // One context menu and tooltip for every tile (RowLayer).
  return (
    <RowLayer
      ref={roving.ref}
      data-rail-scroll
      role="navigation"
      aria-label={name}
      onKeyDown={roving.onKeyDown}
      onScroll={update}
      layout="rail"
      style={{
        maskImage: `linear-gradient(to bottom, ${edges.top ? "transparent, black 20px" : "black, black"}, ${edges.bottom ? "black calc(100% - 20px), transparent" : "black, black"})`,
      }}
    >
      {children}
    </RowLayer>
  );
}

// Ring is a tile's state in the sidebar's own language, drawn round the
// agent's icon: a blue arc that turns while it works, an amber ring when it
// needs you, a green one when it is done, a dashed grey one when its box is
// away.
function Ring({ e }: { e: RailAgent }) {
  if (e.away) return <span aria-hidden {...stylex.props(paint.ring, paint.s19)} />;
  if (e.state === "running") return <span aria-hidden {...stylex.props(paint.ring, paint.s20)} />;
  if (e.state === "waiting") return <span aria-hidden {...stylex.props(paint.ring, paint.s21)} />;
  return <span aria-hidden {...stylex.props(paint.ring, paint.s22)} />;
}

// tileActions are a tile's menu: go to it, and name its worktree.
function tileActions(e: RailAgent) {
  const rename = () => openRenameWorktree(e.box, e.loc, e.wt, { inPlace: false });
  return [
    { type: "item" as const, label: "Open", icon: <SquareArrowOutUpRightIcon />, run: () => focus(e) },
    ...(e.wt.main || e.away
      ? []
      : [
          { type: "sep" as const },
          { type: "item" as const, label: "Rename worktree…", icon: <PencilIcon />, shortcut: "F2", run: rename },
          ...(e.wt.title ? [{ type: "item" as const, label: `Show as ${e.wt.name}`, icon: <span className={sx(paint.s23)} />, run: () => void renameWorktree(e.box, e.loc, e.wt, "") }] : []),
        ]),
  ];
}

function AgentTile({ e }: { e: RailAgent }) {
  return (
    <li className={sx(paint.s24)}>
      {/* On screen: a bar at the rail's edge, in its tab group's colour. */}
      {e.selected || e.tone ? <span aria-hidden className={sx(paint.s25)} style={{ background: e.tone ?? "var(--foreground)" }} /> : null}
      <ContextRow items={() => tileActions(e)}>
        <Tip side="right" align="start" width="none" label={<AgentCard e={e} />}>
          <button
            type="button"
            data-rail-item
            data-testid="rail-agent"
            data-agent-state={e.away ? "away" : e.state}
            data-session={`${e.box}/${e.session.name}`}
            tabIndex={-1}
            aria-label={label(e)}
            aria-current={e.selected || undefined}
            onClick={(ev) => focus(e, ev.altKey)}
            onKeyDown={(ev) => {
              if (ev.key !== "F2" || e.wt.main || e.away) return;
              ev.preventDefault();
              openRenameWorktree(e.box, e.loc, e.wt, { inPlace: false });
            }}
            className={[sx(paint.s26), "group"].filter(Boolean).join(" ")}
          >
            <span className={[sx(paint.s27), e.lane === "waiting" && sx(paint.s28), e.selected && sx(paint.s29), e.away && sx(paint.s30)].filter(Boolean).join(" ")}>
              <AgentIcon agent={e.agent} className={sx(paint.s31)} />
              <Ring e={e} />
            </span>
            <span
              className={[sx(paint.s32), e.selected ? sx(paint.s33) : sx(paint.s34), e.away && sx(paint.s35)].filter(Boolean).join(" ")}
              style={e.tone ? { color: e.tone } : undefined}
            >
              {wtName(e)}
            </span>
          </button>
        </Tip>
      </ContextRow>
    </li>
  );
}

// LaneHead heads a lane with its glyph and count, so how many need you
// stays in sight however far the rail scrolls. It folds the lane away.
function LaneHead({ lane, count, folded, onFold }: { lane: Lane; count: number; folded: boolean; onFold(): void }) {
  const what = lane === "away" ? `${count} on a box that is away` : `${count} ${LANE_WORDS[lane].toLowerCase()}`;
  return (
    <Tip side="right" label={`${what} · ${folded ? "show" : "fold"}`}>
      <button
        type="button"
        data-rail-item
        data-testid="rail-lane"
        data-lane={lane}
        tabIndex={-1}
        aria-expanded={!folded}
        aria-label={`${LANE_WORDS[lane]}: ${count}`}
        onClick={onFold}
        className={sx(paint.s36)}
      >
        {lane === "away" ? <ServerOffIcon className={sx(paint.s37)} /> : <StateGlyph state={lane} className={sx(paint.s38)} />}
        <span className={lane === "waiting" ? sx(paint.s39) : sx(paint.s40)}>{count}</span>
        {folded && <ChevronRightIcon aria-hidden className={sx(paint.s41)} />}
      </button>
    </Tip>
  );
}

// Lanes folded away, on this computer.
const FOLD_KEY = "berth.rail";

// Rail lists the agents in the folded sidebar, by what they need from you:
// those that need you, then those working, then those done, then those on
// a box that went away. Each is its agent's icon in a ring of its state,
// over its worktree's name; the hover card says the rest, and a click goes
// to it. Nothing at all while nothing is happening.
export function RailAgents() {
  const all = useRailAgents();
  const [folded, setFolded] = useState<Lane[]>(() => load<Lane[]>(FOLD_KEY, []));
  const fold = (lane: Lane) =>
    setFolded((f) => {
      const next = f.includes(lane) ? f.filter((l) => l !== lane) : [...f, lane];
      save(FOLD_KEY, next);
      return next;
    });
  if (!all.length) return null;
  return (
    <div className={sx(paint.s42)}>
      <Scroller label="Agents">
        {LANES.map((lane) => {
          const list = all.filter((e) => e.lane === lane);
          if (!list.length) return null;
          const shut = folded.includes(lane);
          return (
            <section key={lane} aria-label={`${LANE_WORDS[lane]}, ${list.length}`} data-testid="rail-section" data-lane={lane} className={sx(paint.s43)}>
              <LaneHead lane={lane} count={list.length} folded={shut} onFold={() => fold(lane)} />
              {!shut && (
                <ul className={sx(paint.s44)}>
                  {list.map((e) => (
                    <AgentTile key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </Scroller>
    </div>
  );
}
