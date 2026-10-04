import { EllipsisIcon, GlobeIcon, MessagesSquareIcon, PencilIcon, ScrollTextIcon, SquareSplitHorizontalIcon, SquareSplitVerticalIcon, SquareTerminalIcon, XIcon } from "lucide-react";
import { useEffect } from "react";

import { Tip } from "@/components/tip";
import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { BrowserPane } from "@/components/browser-pane";
import { ConversationPane } from "@/components/conversation/conversation-pane";
import { ErrorText } from "@/components/error-note";
import { SessionActionItems } from "@/components/orchestrate/session-actions";
import { Button } from "@/components/ui/button";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LogView } from "@/components/workspace/log-view";
import { PanelIcon, PanelPane } from "@/components/workspace/panel-pane";
import { TerminalView } from "@/components/workspace/terminal-view";
import { agentPresets, closePane, openBrowserAt, startSession } from "@/lib/actions";
import { agentLabel, agentOf, sessionAgent, sessionName, sessionState } from "@/lib/derive";
import type { Leaf } from "@/lib/layout";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { startRenaming } from "@/lib/session-title";
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
  const view = usePaneView(pane);
  useEffect(() => {
    if (c.kind !== "terminal" || !session) return;
    const title = session.title?.trim() || undefined;
    if (c.agent !== agent || c.command !== session.command || c.title !== title) setPaneContent(wsKey, tab, pane.id, { ...c, agent, command: session.command, title });
  }, [c, session, agent, wsKey, tab, pane.id]);

  return (
    <div className="flex h-full min-h-0 flex-col" onMouseDownCapture={focus}>
      {split && (
        <div className={cn("group/header flex h-7 shrink-0 items-center gap-1.5 border-b px-2 text-xs", focused ? "bg-accent/50 text-foreground shadow-[inset_0_2px_0_var(--ring)]" : "text-muted-foreground")}>
          <PaneTitle pane={pane} />
          <div className={cn("ml-auto flex items-center transition-opacity", focused ? "opacity-100" : "opacity-0 group-hover/header:opacity-100 focus-within:opacity-100")}>
            <PaneActions wsKey={wsKey} tab={tab} pane={pane} onClose={close} closable focused={focused} />
          </div>
        </div>
      )}
      <div className={cn("relative flex min-h-0 flex-1 flex-col transition-opacity", split && !focused && "opacity-85")}>
        {c.kind === "terminal" && <TerminalView box={c.box} session={c.session} agent={c.agent} command={c.command} wsKey={wsKey} tab={tab} pane={pane.id} visible={visible && view !== "conversation"} focused={focused && view !== "conversation"} onFocus={focus} onClose={close} />}
        {/* The terminal stays connected underneath, so switching back is instant. */}
        {c.kind === "terminal" && view === "conversation" && (
          <div className="absolute inset-0 z-10 flex flex-col">
            <ConversationPane box={c.box} session={c.session} agent={c.agent} visible={visible} onStartAgain={() => void startSession(c.command ?? c.agent ?? "", { kind: "replace", tab, pane: pane.id }, c.agent ? agentLabel(c.agent) : "Agent")} onShowTerminal={() => setPaneContent(wsKey, tab, pane.id, { ...c, view: "terminal" })} />
          </div>
        )}
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
            <p className="font-medium">Couldn't start it</p>
            <ErrorText className="max-w-md items-center text-muted-foreground text-xs" text={c.message} />
            <Button size="sm" variant="outline" onClick={close}>
              Close pane
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// usePaneView is how an agent's pane shows: its terminal, or (Labs) its
// conversation. Shells and other panes are always what they are.
export function usePaneView(pane: Leaf): "terminal" | "conversation" | undefined {
  const c = pane.content;
  const labs = usePrefs((p) => p.labs);
  const fallback = usePrefs((p) => (p.zen ? "conversation" : p.agentView));
  // A pane made for a new session doesn't record its agent; the box's
  // session list says whether it runs one.
  const runsAgent = useStore((st) => {
    if (c.kind !== "terminal") return false;
    if (c.agent) return true;
    const s = st.boxes[c.box]?.sessions?.find((x) => x.name === c.session);
    return !!(s && agentOf(s));
  });
  if (c.kind !== "terminal" || !labs || !runsAgent) return undefined;
  return c.view ?? fallback;
}

// ViewSwitch flips an agent's pane between its terminal and its
// conversation.
export function ViewSwitch({ wsKey, tab, pane }: { wsKey: string; tab: string; pane: Leaf }) {
  const view = usePaneView(pane);
  const c = pane.content;
  if (!view || c.kind !== "terminal") return null;
  return (
    <ToggleGroup
      size="sm"
      variant="outline"
      value={[view]}
      onValueChange={(v) => {
        const next = v[0] as "terminal" | "conversation" | undefined;
        if (!next) return;
        setPaneContent(wsKey, tab, pane.id, { ...c, view: next });
        // The way you last chose to see an agent is how new ones open.
        usePrefs.setState({ agentView: next });
      }}
      aria-label="Show the agent as"
      className="mr-1"
    >
      <Tip label="Terminal">
        <ToggleGroupItem value="terminal" aria-label="Terminal" className="h-6! min-w-7! px-1!">
          <SquareTerminalIcon className="size-3.5" />
        </ToggleGroupItem>
      </Tip>
      <Tip label="Conversation">
        <ToggleGroupItem value="conversation" aria-label="Conversation" className="h-6! min-w-7! px-1!">
          <MessagesSquareIcon className="size-3.5" />
        </ToggleGroupItem>
      </Tip>
    </ToggleGroup>
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

function PaneTitle({ pane }: { pane: Leaf }) {
  const c = pane.content;
  const session = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  const stats = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.stats : undefined));
  // Named as everywhere else: its title, then its agent ("Fix checkout
  // webhook · Claude Code"), or "Claude Code", "Shell 2" (sessionName).
  const named = useStore((s) => (c.kind === "terminal" && session ? sessionName(session, { sessions: s.boxes[c.box]?.sessions }) : undefined));
  const agent = session ? agentOf(session) : undefined;
  const label = named ?? paneLabel(c, agent);
  const secondary = session ? sessionAgent(session) : "";
  // Honest about what it can't know: nothing while the box is away, ended
  // once the box no longer lists the session.
  const away = useStore((s) => c.kind === "terminal" && !!s.status && s.status.boxes.find((b) => b.name === c.box)?.state !== "online");
  const gone = useStore((s) => c.kind === "terminal" && !session && !!s.boxes[c.box]?.sessions);
  const state = away ? undefined : session ? sessionState(session, stats) : gone ? "exited" : undefined;
  return (
    <Tip label={c.kind === "terminal" ? `${c.session} on ${c.box}${away ? ` · ${c.box} is offline` : ""}` : undefined} align="start">
      <span className="flex min-w-0 items-center gap-1.5">
        <PaneIcon content={c} agent={agent} />
        <span className="truncate">{label}</span>
        {secondary && <span className="shrink-0 text-muted-foreground">{secondary}</span>}
        {state && <StateGlyph state={state} className="size-3" />}
      </span>
    </Tip>
  );
}

// PaneActions are a pane's split buttons and its ⋯ menu: in the pane's own
// header when the tab is split, and in the tab strip when it is not.
// ⌘W and ⌘D act on the focused pane, so only its buttons name them.
export function PaneActions({ wsKey, tab, pane, onClose, closable, focused = true }: { wsKey: string; tab: string; pane: Leaf; onClose?: () => void; closable?: boolean; focused?: boolean }) {
  const c = pane.content;
  const session = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  const ref = useWorkspaces((s) => s.spaces[wsKey]?.ref);
  const agent = session && agentOf(session);
  const close = onClose ?? (() => void closePane(wsKey, tab, pane.id));
  const beside = (dir: "row" | "col") => ({ kind: "split" as const, tab, pane: pane.id, dir });

  return (
    <>
      <ViewSwitch wsKey={wsKey} tab={tab} pane={pane} />
      <HeaderButton label="Split right" keys={focused ? "⌘D" : undefined} onClick={() => void startSession("", beside("row"))}>
        <SquareSplitHorizontalIcon />
      </HeaderButton>
      <HeaderButton label="Split down" keys={focused ? "⌘⇧D" : undefined} onClick={() => void startSession("", beside("col"))}>
        <SquareSplitVerticalIcon />
      </HeaderButton>
      <Menu>
        <Tip label="Pane actions">
          <MenuTrigger render={<button type="button" aria-label="Pane actions" className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent" />}>
            <EllipsisIcon className="size-3.5" />
          </MenuTrigger>
        </Tip>
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
          {c.kind === "terminal" && session && (
            <MenuItem onClick={() => startRenaming(c.box, c.session)}>
              <PencilIcon />
              Rename…
            </MenuItem>
          )}
          <MenuItem onClick={close}>
            <XIcon />
            {closable ? "Close pane" : "Close tab"}
            {focused && <MenuShortcut>⌘W</MenuShortcut>}
          </MenuItem>
        </MenuPopup>
      </Menu>
      {closable && (
        <HeaderButton label="Close pane" keys={focused ? "⌘W" : undefined} onClick={close}>
          <XIcon />
        </HeaderButton>
      )}
    </>
  );
}

function HeaderButton({ label, keys, onClick, children }: { label: string; keys?: string; onClick(): void; children: React.ReactNode }) {
  return (
    <Tip
      label={
        <span className="flex items-center gap-2">
          {label}
          {keys && <span className="text-muted-foreground">{keys}</span>}
        </span>
      }
    >
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
      >
        {children}
      </button>
    </Tip>
  );
}
