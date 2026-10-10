import * as stylex from "@stylexjs/stylex";
import { BrushCleaningIcon, ChevronRightIcon, ListChecksIcon, PlusIcon, SendIcon, ServerIcon, SquareIcon, TerminalIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Scene } from "@/components/art/scenes";
import { BoxFilter, shownBoxes as shownOf } from "@/components/box-filter";
import { Tip } from "@/components/tip";
import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { type SessionEntry, useAllSessions } from "@/hooks/use-agent-counts";
import { liftToasts } from "@/hooks/lift-toasts";
import { agentOf, type SessionState, worktreeOf } from "@/lib/derive";
import { ago } from "@/lib/format";
import { openBroadcast } from "@/lib/prompts";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { focusSession } from "@/lib/workspaces";
import { AgentCard } from "@/views/dashboard/agent-card";
import { ColumnMenu, openStop, StopDialog } from "@/views/dashboard/stop";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { ViewHeader } from "@/views/view-header";
import { sessionWord } from "@/lib/state-model";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s2: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s3: {
    "display": "grid",
    "gridTemplateColumns": "repeat(auto-fit,minmax(250px,1fr))",
    "alignItems": "flex-start",
    "columnGap": "16px",
    "rowGap": "24px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "16px",
    "paddingBottom": "24px",
  },
  s4: {
    "minWidth": "0px",
  },
  s5: {
    "marginBottom": "8px",
    "display": "flex",
    "minHeight": "20px",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "2px",
    "paddingRight": "2px",
  },
  s6: {
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "marginLeft": "auto",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s9: {
    "marginLeft": "auto",
  },
  s10: {
    "color": "var(--warning-foreground)",
  },
  s11: {
    "color": "var(--muted-foreground)",
  },
  s12: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "var(--row-gap)",
  },
  s13: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s15: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s17: {
    "transform": "rotate(90deg)",
  },
  s18: {
    "width": "14px",
    "height": "14px",
  },
  s19: {
    "marginTop": "8px",
    "marginBottom": "8px",
    "display": "grid",
    "gridTemplateColumns": "repeat(auto-fill,minmax(220px,1fr))",
    "gap": "8px",
  },
  s20: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": 0,
    "right": 0,
    "bottom": "16px",
    "display": "flex",
    "justifyContent": "center",
  },
  s21: {
    "pointerEvents": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s22: {
    "paddingRight": "4px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontVariantNumeric": "tabular-nums",
  },
  s23: {
    "color": "var(--destructive-foreground)",
  },
  s24: {
    "height": "20px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s25: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)",
    },
    "backgroundColor": "color-mix(in oklab, var(--card) 60%, transparent)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s27: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

interface Column {
  state: SessionState;
  title: string;
  empty: string;
}

const COLUMNS: Column[] = [
  { state: "waiting", title: sessionWord("waiting"), empty: "Nothing needs you." },
  { state: "running", title: sessionWord("running"), empty: "No agent is working." },
  { state: "finished", title: sessionWord("finished"), empty: "Finished turns land here." },
  { state: "ready", title: sessionWord("ready"), empty: "Agents open with nothing to do." },
];

// Cards in a column: the longest in that state first, so what has waited
// longest is on top.
const sinceOf = (e: SessionEntry) => new Date(e.session.state_since ?? e.session.created).getTime();

// DashboardView is every agent on every box as a board, by what it needs:
// you, time, a look at what it did, or a first prompt.
export function DashboardView() {
  const all = useAllSessions();
  // With no box at all, a new worktree has nowhere to go: the way on is a box.
  const noBoxes = useStore((s) => !!s.status && s.status.boxes.length === 0);
  const boxNames = useMemo(() => [...new Set(all.map((e) => e.box))].sort(), [all]);
  const [hidden, setHidden] = useState<string[]>(() => load("berth.dashboard.hiddenBoxes", []));
  const [showRest, setShowRest] = useState(false);
  const shownBoxes = shownOf(boxNames, hidden);
  const visible = all.filter((e) => shownBoxes.includes(e.box));
  const rest = visible.filter((e) => !COLUMNS.some((c) => c.state === e.state));
  const agents = all.filter((e) => COLUMNS.some((c) => c.state === e.state));
  const filtered = shownBoxes.length < boxNames.length;
  // Picked cards, to send them all one prompt. Undefined when not picking.
  const [picked, setPicked] = useState<Set<string>>();
  const keyOf = (e: SessionEntry) => `${e.box}/${e.session.name}`;
  const pick = (keys: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      for (const k of keys) {
        if (on) n.add(k);
        else n.delete(k);
      }
      return n;
    });
  const pickedEntries = agents.filter((e) => picked?.has(keyOf(e)));
  // Clean up offers what sits in Done and Ready on the boxes shown; it never
  // includes an agent that is working or waiting on you.
  const idle = visible.filter((e) => e.state === "finished" || e.state === "ready");
  const stopPicked = () => openStop({ kind: "stop", entries: pickedEntries });
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      // A dialog or menu holds focus while open, and takes its own keys (a
      // toast is a dialog too, so its mere presence doesn't count).
      const t = e.target as HTMLElement | null;
      if (t?.closest("[role=dialog],[role=alertdialog],[role=menu]")) return;
      if (e.key === "Escape") setPicked(undefined);
      // ⌫ or Delete on a selection asks to stop it, unless typing.
      if ((e.key === "Backspace" || e.key === "Delete") && !t?.closest("input,textarea,select,[contenteditable=true]") && pickedEntries.length) {
        e.preventDefault();
        stopPicked();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hide = (next: string[]) => {
    setHidden(next);
    save("berth.dashboard.hiddenBoxes", next);
  };

  return (
    <div className={sx(paint.s0)}>
      <ViewHeader
        title="Agent Dashboard"
        description={filtered ? `Showing ${shownBoxes.join(", ")} only` : "Every agent on every box, by what it needs."}
        actions={
          <div className={sx(paint.s1)}>
            {agents.length > 0 && (
              <Tip label="Pick agents to prompt or stop several at once (or ⌘-click cards)">
                <Button size="xs" variant={picked ? "secondary" : "ghost"} aria-pressed={!!picked} onClick={() => setPicked(picked ? undefined : new Set())}>
                  <ListChecksIcon />
                  {picked ? "Done selecting" : "Select"}
                </Button>
              </Tip>
            )}
            {idle.length > 0 && (
              <Tip label="Stop agents that have sat in Done or Ready for a while">
                <Button size="xs" variant="ghost" onClick={() => openStop({ kind: "cleanup", entries: idle })}>
                  <BrushCleaningIcon />
                  Clean up…
                </Button>
              </Tip>
            )}
            {filtered && (
              <Button size="xs" variant="ghost" onClick={() => hide([])}>
                Show all
              </Button>
            )}
            <BoxFilter boxes={boxNames} hidden={hidden} onChange={hide} />
          </div>
        }
      />

      {agents.length === 0 ? (
        <Empty space="16">
          <EmptyHeader>
            <EmptyMedia>
              <Scene name="setting-out" />
            </EmptyMedia>
            <EmptyTitle>No agents yet</EmptyTitle>
            <EmptyDescription>{noBoxes ? "Agents run on your boxes, and there isn't one yet. Add a box, then start an agent in a new worktree on it." : "Start one in a new worktree, or from any worktree's + menu."}</EmptyDescription>
          </EmptyHeader>
          {noBoxes ? (
            <Button onClick={openAddBox}>
              <ServerIcon />
              Add a box
            </Button>
          ) : (
            <Button onClick={() => useStore.getState().openNewWorktree()}>
              <PlusIcon />
              New worktree
            </Button>
          )}
        </Empty>
      ) : (
        <div className={sx(paint.s2)}>
          <div className={sx(paint.s3)}>
            {COLUMNS.map((c) => {
              const items = visible.filter((e) => e.state === c.state).sort((a, b) => sinceOf(a) - sinceOf(b));
              return (
                <section key={c.state} aria-label={c.title} className={sx(paint.s4)}>
                  <header className={sx(paint.s5)}>
                    <StateGlyph state={c.state} />
                    <h2 className={sx(paint.s6)}>{c.title}</h2>
                    {picked && items.length > 0 && (
                      <button type="button" className={sx(paint.s7)} onClick={() => pick(items.map(keyOf), !items.every((e) => picked.has(keyOf(e))))}>
                        {items.every((e) => picked.has(keyOf(e))) ? "None" : "All"}
                      </button>
                    )}
                    <span className={[sx(paint.s8), !(picked && items.length) && sx(paint.s9), items.length && c.state === "waiting" ? sx(paint.s10) : sx(paint.s11)].filter(Boolean).join(" ")}>{items.length}</span>
                    {items.length > 0 && (
                      <ColumnMenu
                        title={c.title}
                        items={items}
                        cleanup={c.state === "finished" || c.state === "ready" ? idle : undefined}
                        onPick={() => {
                          setPicked((s) => new Set([...(s ?? []), ...items.map(keyOf)]));
                        }}
                      />
                    )}
                  </header>
                  <div className={sx(paint.s12)}>
                    {items.length === 0 ? (
                      <p className={sx(paint.s13)}>{c.empty}</p>
                    ) : (
                      items.map((e) => (
                        <AgentCard
                          key={`${e.box}/${e.session.name}:${e.state}`}
                          entry={e}
                          selecting={!!picked}
                          selected={picked?.has(keyOf(e))}
                          onSelect={() => pick([keyOf(e)], !picked?.has(keyOf(e)))}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className={sx(paint.s14)}>
              <button type="button" aria-expanded={showRest} onClick={() => setShowRest(!showRest)} className={sx(paint.s15)}>
                <ChevronRightIcon className={[sx(paint.s16), showRest && sx(paint.s17)].filter(Boolean).join(" ")} />
                <TerminalIcon className={sx(paint.s18)} />
                Shells & ended · {summary(rest)}
              </button>
              {showRest && (
                <div className={sx(paint.s19)}>
                  {rest.map((e) => (
                    <QuietCard key={`${e.box}/${e.session.name}`} entry={e} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {picked && (
        <div className={sx(paint.s20)}>
          <div ref={liftToasts} className={sx(paint.s21)}>
            <span className={sx(paint.s22)}>{pickedEntries.length ? `${pickedEntries.length} selected` : "Click cards to select them"}</span>
            <Button size="xs" disabled={!pickedEntries.length} onClick={() => openBroadcast({ targets: pickedEntries.map((e) => ({ box: e.box, session: e.session.name })) })}>
              <SendIcon />
              {pickedEntries.length ? `Send to ${pickedEntries.length} agent${pickedEntries.length === 1 ? "" : "s"}…` : "Send to agents…"}
            </Button>
            <Tip label={pickedEntries.length ? "Stop the selected agents (⌫)" : undefined}>
              <span className={sx(paint.s23)}><Button size="xs" variant="outline"  disabled={!pickedEntries.length} onClick={stopPicked}>
                <SquareIcon />
                {pickedEntries.length ? `Stop ${pickedEntries.length}…` : "Stop…"}
              </Button></span>
            </Tip>
            <span className={sx(paint.s24)} />
            <Button size="xs" variant="ghost" onClick={() => setPicked(undefined)}>
              Cancel
              <Kbd>Esc</Kbd>
            </Button>
          </div>
        </div>
      )}
      <StopDialog />
    </div>
  );
}

// QuietCard is a shell or an exited session: just where it is, one click
// from opening.
function QuietCard({ entry }: { entry: SessionEntry }) {
  const { box, session, state } = entry;
  const locations = useStore((s) => s.boxes[box]?.locations);
  const where = worktreeOf(locations, session);
  return (
    <button type="button" onClick={() => void focusSession(box, session.name)} className={sx(paint.s25)}>
      <AgentIcon agent={agentOf(session)} />
      <span className={sx(paint.s26)}>{where?.worktree.main ? where.location.name : (where?.worktree.name ?? session.name)}</span>
      <span className={sx(paint.s27)}>{state === "exited" ? sessionWord("exited", true) : `${box} · ${ago(session.created)}`}</span>
    </button>
  );
}

function summary(entries: SessionEntry[]): string {
  const shells = entries.filter((e) => e.state === "idle").length;
  const exited = entries.filter((e) => e.state === "exited").length;
  return [shells && `${shells} shell${shells === 1 ? "" : "s"}`, exited && `${exited} ended`].filter(Boolean).join(", ");
}
