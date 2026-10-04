import { CloudOffIcon, PencilIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { StateGlyph } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { ContextMenu, ContextMenuItem, ContextMenuPopup, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { NewTabMenu } from "@/components/workspace/new-tab-menu";
import { PaneActions, PaneIcon, paneLabel } from "@/components/workspace/pane";
import { RunMenu } from "@/components/workspace/run-menu";
import { closeTab } from "@/lib/actions";
import { agentOf, type SessionState, sessionAgent, sessionName, sessionState } from "@/lib/derive";
import { type Leaf, leaves } from "@/lib/layout";
import { renameSession } from "@/lib/session-title";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { activateTab, moveTab, useWorkspaces, type WsTab } from "@/lib/workspaces";

// TabStrip is the current worktree's tabs across the top, as in Orca. It is
// also the window's drag handle. A tab that is not split has no pane header,
// so its pane's actions sit at the strip's right.
export function TabStrip() {
  const key = useWorkspaces((s) => s.current);
  const ws = useWorkspaces((s) => (s.current ? s.spaces[s.current] : undefined));
  const [dragging, setDragging] = useState<number>();
  const active = ws?.tabs.find((t) => t.id === ws.active);
  const lone = active && active.root.kind === "leaf" ? active.root : undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Which ends have tabs scrolled past them, for the fades that say so.
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    measure();
    return () => ro.disconnect();
  }, [measure, ws?.tabs.length]);

  // The active tab is always in view: brought in when it changes (⌘T, ⌘⇧B,
  // a tab opened by an agent) and when the strip narrows.
  useLayoutEffect(() => {
    const el = scroller.current;
    const tab = ws?.active ? el?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(ws.active)}"]`) : null;
    if (!el || !tab) return;
    const reveal = () => {
      const start = tab.offsetLeft;
      const end = start + tab.offsetWidth;
      if (start < el.scrollLeft) el.scrollLeft = start;
      else if (end > el.scrollLeft + el.clientWidth) el.scrollLeft = end - el.clientWidth;
      measure();
    };
    reveal();
    const ro = new ResizeObserver(reveal);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ws?.active, ws?.tabs.length, measure]);

  const fade = edges.left && edges.right ? "[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]" : edges.left ? "[mask-image:linear-gradient(to_right,transparent,black_24px)]" : edges.right ? "[mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]" : "";

  return (
    <div data-tauri-drag-region className="flex h-10 shrink-0 items-stretch border-b bg-sidebar">
      {/* Tabs scroll when they do not fit (a wheel scrolls them sideways),
          with a fade at each end that has more; + stays just after them,
          outside the scroller, so it never scrolls away. */}
      <div
        ref={scroller}
        data-tauri-drag-region
        onScroll={measure}
        onWheel={(e) => {
          const el = scroller.current;
          if (!el || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
          el.scrollLeft += e.deltaY;
        }}
        className={cn("relative flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]", fade)}
      >
        {key &&
          ws?.tabs.map((t, i) => (
            <TabButton
              key={t.id}
              tab={t}
              active={t.id === ws.active}
              onActivate={() => activateTab(key, t.id)}
              onClose={() => void closeTab(key, t.id)}
              onDragStart={() => setDragging(i)}
              onDrop={() => {
                if (dragging !== undefined && dragging !== i) moveTab(key, dragging, i);
                setDragging(undefined);
              }}
            />
          ))}
      </div>
      {ws && (
        <div className="flex shrink-0 items-center px-1">
          <NewTabMenu />
        </div>
      )}
      <div data-tauri-drag-region className="min-w-4 flex-1" />
      {ws && (
        <div data-tauri-drag-region className="flex shrink-0 items-center gap-2 pr-2 pl-3 text-muted-foreground text-xs">
          <Tip label={`${ws.ref.box}:${ws.ref.path}`} side="bottom">
            <span data-tauri-drag-region className="max-w-56 truncate">
              {ws.ref.location}
              {ws.ref.main ? "" : ` / ${ws.ref.worktree}`}
              <span className="ml-1.5 rounded bg-accent/70 px-1 py-px font-mono text-[10px]">{ws.ref.box}</span>
            </span>
          </Tip>
          <RunMenu />
          {key && active && lone && (
            <div className="flex items-center border-l pl-1">
              <PaneActions wsKey={key} tab={active.id} pane={lone} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


interface TabProps {
  tab: WsTab;
  active: boolean;
  onActivate(): void;
  onClose(): void;
  onDragStart(): void;
  onDrop(): void;
}

function TabButton({ tab, active, onActivate, onClose, onDragStart, onDrop }: TabProps) {
  const boxes = useStore((s) => s.boxes);
  const status = useStore((s) => s.status);
  const panes = leaves(tab.root);

  // A tab is named after its most important pane: an agent that needs you,
  // then one working, then the focused pane.
  const ranked = panes
    .map((l) => {
      const c = l.content;
      const s = c.kind === "terminal" ? boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined;
      const state = s && c.kind === "terminal" ? sessionState(s, boxes[c.box]?.stats) : undefined;
      return { l, s, state, agent: s ? agentOf(s) : c.kind === "terminal" ? c.agent : undefined };
    })
    .sort((a, b) => rank(a, tab.focus) - rank(b, tab.focus));
  const lead = ranked[0];
  const c = lead.l.content;
  const offline = c.kind === "terminal" && status?.boxes.find((b) => b.name === c.box)?.state !== "online" && !!status;
  // Named as everywhere else (sessionName): the session's title, or its
  // agent's name; the agent and the session id are in the tooltip.
  const title = lead.s ? sessionName(lead.s, { sessions: c.kind === "terminal" ? boxes[c.box]?.sessions : undefined }) : paneLabel(c, lead.agent);
  const secondary = lead.s ? sessionAgent(lead.s) : "";
  const session = c.kind === "terminal" && lead.s ? { box: c.box, name: lead.s.name } : undefined;
  const [editing, setEditing] = useState(false);

  const tab$ = (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      data-tab={tab.id}
      className={cn(
        "group relative flex h-full min-w-24 max-w-56 shrink-0 cursor-default items-center gap-1.5 border-r pr-1 pl-3 text-xs data-popup-open:bg-background/60",
        active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background/40 hover:text-foreground",
      )}
      onMouseDown={(e) => {
        // Middle click closes, as in a browser.
        if (e.button === 1) {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={onActivate}
      onDoubleClick={() => session && setEditing(true)}
    >
      {active && <span className="absolute inset-x-0 top-0 h-px bg-foreground/50" />}
      {offline ? (
        <CloudOffIcon className="size-3 shrink-0 text-muted-foreground" aria-label="box offline" />
      ) : lead.state && lead.state !== "idle" ? (
        <StateGlyph state={lead.state} className="size-3" />
      ) : null}
      <PaneIcon content={c} agent={lead.agent} className="size-3" />
      {editing && session ? (
        <TitleInput
          initial={lead.s?.title ?? ""}
          placeholder={paneLabel(c, lead.agent)}
          onDone={(next) => {
            setEditing(false);
            if (next !== undefined && next !== (lead.s?.title ?? "")) void renameSession(session.box, session.name, next);
          }}
        />
      ) : (
        <span className="min-w-0 truncate">{title}</span>
      )}
      {panes.length > 1 && <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">+{panes.length - 1}</span>}
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn("ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent", active ? "opacity-70" : "opacity-0 group-hover:opacity-70")}
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="flex shrink-0 items-stretch" />}>
        {editing ? (
          tab$
        ) : (
          <Tip label={c.kind === "terminal" ? [title, secondary, c.session].filter(Boolean).join(" · ") : undefined} side="bottom" align="start">
            {tab$}
          </Tip>
        )}
      </ContextMenuTrigger>
      <ContextMenuPopup className="min-w-48">
        {session && (
          <ContextMenuItem onClick={() => setEditing(true)}>
            <PencilIcon />
            <span className="flex-1">Rename…</span>
          </ContextMenuItem>
        )}
        {session && lead.s?.title && (
          <ContextMenuItem onClick={() => void renameSession(session.box, session.name, "")}>
            <span className="size-4" />
            <span className="flex-1">Use the agent's name</span>
          </ContextMenuItem>
        )}
        {session && <ContextMenuSeparator />}
        <ContextMenuItem onClick={onClose}>
          <XIcon />
          <span className="flex-1">Close tab</span>
          <ContextMenuShortcut>⌘W</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuPopup>
    </ContextMenu>
  );
}

// TitleInput renames a session in place: Enter keeps it, Escape or leaving
// the field without a change drops it. Empty means the agent's name again.
function TitleInput({ initial, placeholder, onDone }: { initial: string; placeholder: string; onDone(next?: string): void }) {
  const [v, setV] = useState(initial);
  const done = useRef(false);
  const finish = (next?: string) => {
    if (done.current) return;
    done.current = true;
    onDone(next);
  };
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: the person asked to rename it
      autoFocus
      value={v}
      maxLength={80}
      aria-label="Session title"
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(v.trim());
        if (e.key === "Escape") finish();
      }}
      onBlur={() => finish(v.trim())}
      className="h-6 w-40 min-w-0 rounded border border-ring bg-background px-1.5 text-foreground text-xs outline-none ring-2 ring-ring/24 placeholder:text-muted-foreground/72"
    />
  );
}

function rank(x: { l: Leaf; state?: SessionState; agent?: string }, focus: string): number {
  if (x.state === "waiting") return 0;
  if (x.state === "running") return 1;
  if (x.l.id === focus) return 2;
  return x.agent ? 3 : 4;
}
