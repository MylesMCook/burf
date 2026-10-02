import { EllipsisIcon, GlobeIcon, ScrollTextIcon, SquareSplitHorizontalIcon, SquareSplitVerticalIcon, XIcon } from "lucide-react";
import { useEffect } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { BrowserPane } from "@/components/browser-pane";
import { SessionActionItems } from "@/components/orchestrate/session-actions";
import { Button } from "@/components/ui/button";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { LogView } from "@/components/workspace/log-view";
import { PanelIcon, PanelPane } from "@/components/workspace/panel-pane";
import { TerminalView } from "@/components/workspace/terminal-view";
import { agentPresets, closePane, openBrowserAt, startSession } from "@/lib/actions";
import { agentLabel, agentOf, sessionState } from "@/lib/derive";
import type { Leaf } from "@/lib/layout";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { focusPane, setPaneContent, useWorkspaces } from "@/lib/workspaces";

export { agentLabel };

interface Props {
  wsKey: string;
  tab: string;
  pane: Leaf;
  visible: boolean;
  focused: boolean;
  // More than one pane in the tab. Only then does a pane have its own
  // header; a lone pane's actions are in the tab strip.
  split: boolean;
}

// Pane is one leaf of a tab's split tree: a terminal, a browser, a log or a
// plugin's panel, under a slim header when the tab is split.
export function Pane({ wsKey, tab, pane, visible, focused, split }: Props) {
  const focus = () => {
    if (!focused) focusPane(wsKey, tab, pane.id);
  };
  const close = () => void closePane(wsKey, tab, pane.id);
  const c = pane.content;
  const session = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));

  // Remember what runs here, so the pane can name it and start it again
  // once the session itself is gone.
  const agent = session ? agentOf(session) : undefined;
  useEffect(() => {
    if (c.kind !== "terminal" || !session) return;
    if (c.agent !== agent || c.command !== session.command) setPaneContent(wsKey, tab, pane.id, { ...c, agent, command: session.command });
  }, [c, session, agent, wsKey, tab, pane.id]);

  return (
    <div className="flex h-full min-h-0 flex-col" onMouseDownCapture={focus}>
      {split && (
        <div className={cn("group/header flex h-7 shrink-0 items-center gap-1.5 border-b px-2 text-xs", focused ? "bg-accent/50 text-foreground shadow-[inset_0_2px_0_var(--ring)]" : "text-muted-foreground")}>
          <PaneTitle wsKey={wsKey} tab={tab} pane={pane} />
          <div className={cn("ml-auto flex items-center transition-opacity", focused ? "opacity-100" : "opacity-0 group-hover/header:opacity-100 focus-within:opacity-100")}>
            <PaneActions wsKey={wsKey} tab={tab} pane={pane} onClose={close} closable />
          </div>
        </div>
      )}
      <div className={cn("relative flex min-h-0 flex-1 flex-col transition-opacity", split && !focused && "opacity-85")}>
        {c.kind === "terminal" && <TerminalView box={c.box} session={c.session} agent={c.agent} command={c.command} wsKey={wsKey} tab={tab} pane={pane.id} visible={visible} focused={focused} onFocus={focus} onClose={close} />}
        {c.kind === "browser" && <BrowserPane id={pane.id} url={c.url} visible={visible} onNavigate={(url) => setPaneContent(wsKey, tab, pane.id, { kind: "browser", url })} />}
        {c.kind === "log" && <LogView box={c.box} location={c.location} worktree={c.worktree} service={c.service} visible={visible} />}
        {c.kind === "panel" && <PanelPane wsKey={wsKey} plugin={c.plugin} panel={c.panel} />}
        {c.kind === "starting" && (
          <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground text-sm">
            <Spinner className="size-4" />
            Starting {c.label}…
          </div>
        )}
        {c.kind === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
            <p className="font-medium">Could not start it</p>
            <p className="max-w-md text-muted-foreground text-xs">{c.message}</p>
            <Button size="sm" variant="outline" onClick={close}>
              Close pane
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// paneLabel is what a pane is called in headers and tabs: the agent's name,
// "Shell", "Browser", or the plugin panel's title.
export function paneLabel(c: Leaf["content"], agent?: string): string {
  switch (c.kind) {
    case "terminal":
      return agent || c.agent ? agentLabel((agent ?? c.agent)!) : "Shell";
    case "browser":
      return "Browser";
    case "log":
      return `${c.service} log`;
    case "panel":
      return c.title;
    case "starting":
      return c.label;
    default:
      return "Error";
  }
}

export function PaneIcon({ content, agent, className }: { content: Leaf["content"]; agent?: string; className?: string }) {
  const c = content;
  if (c.kind === "browser") return <GlobeIcon className={cn("size-3.5 shrink-0", className)} />;
  if (c.kind === "log") return <ScrollTextIcon className={cn("size-3.5 shrink-0", className)} />;
  if (c.kind === "panel") return <PanelIcon plugin={c.plugin} panel={c.panel} className={cn("size-3.5 shrink-0", className)} />;
  return <AgentIcon agent={agent ?? (c.kind === "terminal" ? c.agent : undefined)} className={cn("size-3", className)} />;
}

function PaneTitle({ wsKey, tab, pane }: { wsKey: string; tab: string; pane: Leaf }) {
  const c = pane.content;
  const session = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  const stats = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.stats : undefined));
  // Shells are numbered within their tab: Shell, Shell 2.
  const shellNo = useWorkspaces((s) => {
    if (c.kind !== "terminal" || c.agent) return 0;
    const t = s.spaces[wsKey]?.tabs.find((x) => x.id === tab);
    const shells = t ? collect(t.root).filter((l) => l.content.kind === "terminal" && !l.content.agent) : [];
    return shells.findIndex((l) => l.id === pane.id) + 1;
  });
  const agent = session ? agentOf(session) : undefined;
  const label = paneLabel(c, agent) + (shellNo > 1 ? ` ${shellNo}` : "");
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={c.kind === "terminal" ? c.session : undefined}>
      <PaneIcon content={c} agent={agent} />
      <span className="truncate">{label}</span>
      {session && <StateGlyph state={sessionState(session, stats)} className="size-3" />}
    </span>
  );
}

function collect(n: import("@/lib/layout").PaneNode): Leaf[] {
  return n.kind === "leaf" ? [n] : [...collect(n.a), ...collect(n.b)];
}

// PaneActions are a pane's split buttons and its ⋯ menu: in the pane's own
// header when the tab is split, and in the tab strip when it is not.
export function PaneActions({ wsKey, tab, pane, onClose, closable }: { wsKey: string; tab: string; pane: Leaf; onClose?: () => void; closable?: boolean }) {
  const c = pane.content;
  const session = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  const ref = useWorkspaces((s) => s.spaces[wsKey]?.ref);
  const agent = session && agentOf(session);
  const close = onClose ?? (() => void closePane(wsKey, tab, pane.id));
  const beside = (dir: "row" | "col") => ({ kind: "split" as const, tab, pane: pane.id, dir });

  return (
    <>
      <HeaderButton label="Split right" keys="⌘D" onClick={() => void startSession("", beside("row"))}>
        <SquareSplitHorizontalIcon />
      </HeaderButton>
      <HeaderButton label="Split down" keys="⌘⇧D" onClick={() => void startSession("", beside("col"))}>
        <SquareSplitVerticalIcon />
      </HeaderButton>
      <Menu>
        <MenuTrigger render={<button type="button" aria-label="Pane actions" title="Pane actions" className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent" />}>
          <EllipsisIcon className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-56">
          {c.kind === "terminal" && agent && (
            <>
              <SessionActionItems box={c.box} session={c.session} />
              <MenuSeparator />
            </>
          )}
          <MenuGroup>
            <MenuGroupLabel>Open beside</MenuGroupLabel>
            {ref &&
              agentPresets(ref.box, ref.location).map((p) => (
                <MenuItem key={p.id} onClick={() => void startSession(p.command, beside("row"), p.name)}>
                  <span className="flex size-4 items-center justify-center">
                    <AgentIcon agent={p.id} />
                  </span>
                  {p.name}
                </MenuItem>
              ))}
            <MenuItem onClick={() => void startSession("", beside("row"))}>
              <span className="flex size-4 items-center justify-center">
                <AgentIcon />
              </span>
              Shell
            </MenuItem>
            <MenuItem onClick={() => openBrowserAt("", beside("row"))}>
              <span className="flex size-4 items-center justify-center">
                <GlobeIcon />
              </span>
              Browser
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuItem onClick={close}>
            <XIcon />
            {closable ? "Close pane" : "Close tab"}
            <MenuShortcut>⌘W</MenuShortcut>
          </MenuItem>
        </MenuPopup>
      </Menu>
      {closable && (
        <HeaderButton label="Close pane" keys="⌘W" onClick={close}>
          <XIcon />
        </HeaderButton>
      )}
    </>
  );
}

function HeaderButton({ label, keys, onClick, children }: { label: string; keys?: string; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={keys ? `${label} (${keys})` : label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}
