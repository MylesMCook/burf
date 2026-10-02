import { CloudOffIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { StateGlyph } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { NewTabMenu } from "@/components/workspace/new-tab-menu";
import { PaneActions, PaneIcon, paneLabel } from "@/components/workspace/pane";
import { RunMenu } from "@/components/workspace/run-menu";
import { closeTab } from "@/lib/actions";
import { agentOf, type SessionState, sessionName, sessionState } from "@/lib/derive";
import { type Leaf, leaves } from "@/lib/layout";
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

  return (
    <div data-tauri-drag-region className="flex h-10 shrink-0 items-stretch border-b bg-sidebar">
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none]">
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
        {ws && (
          <div className="flex items-center px-1">
            <NewTabMenu />
          </div>
        )}
        <div data-tauri-drag-region className="flex-1" />
      </div>
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
  // Named as everywhere else (sessionName); the session id is in the tooltip.
  const title = lead.s ? sessionName(lead.s, { sessions: c.kind === "terminal" ? boxes[c.box]?.sessions : undefined }) : paneLabel(c, lead.agent);

  return (
    <Tip label={c.kind === "terminal" ? `${title} · ${c.session}` : undefined} side="bottom" align="start">
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          "group relative flex min-w-24 max-w-56 shrink-0 cursor-default items-center gap-1.5 border-r pr-1 pl-3 text-xs",
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
      >
        {active && <span className="absolute inset-x-0 top-0 h-px bg-foreground/50" />}
        {offline ? (
          <CloudOffIcon className="size-3 shrink-0 text-muted-foreground" aria-label="box offline" />
        ) : lead.state && lead.state !== "idle" ? (
          <StateGlyph state={lead.state} className="size-3" />
        ) : null}
        <PaneIcon content={c} agent={lead.agent} className="size-3" />
        <span className="min-w-0 truncate">{title}</span>
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
    </Tip>
  );
}

function rank(x: { l: Leaf; state?: SessionState; agent?: string }, focus: string): number {
  if (x.state === "waiting") return 0;
  if (x.state === "running") return 1;
  if (x.l.id === focus) return 2;
  return x.agent ? 3 : 4;
}
