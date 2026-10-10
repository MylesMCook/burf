import * as stylex from "@stylexjs/stylex";
import { AppWindowIcon, ArchiveIcon, ChartColumnIcon, FileTextIcon, GaugeIcon, LayoutGridIcon, TableIcon, WorkflowIcon, ArrowLeftRightIcon, Columns2Icon, EllipsisIcon, GlobeIcon, MonitorSmartphoneIcon, PencilIcon, ScrollTextIcon, SquareSplitHorizontalIcon, SquareSplitVerticalIcon, XIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";


import { Tip } from "@/components/tip";
import { RemoteChatPane } from "@/views/remote-chat";
import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { BrowserPane } from "@/components/browser-pane";
import { PreviewPane } from "@/components/preview-pane";
import { FileGlyph } from "@/components/files/file-bits";
import { EmptySide } from "@/components/workspace/compare-view";
import { CompareSideContext, type CompareSide, pageLoading } from "@/lib/compare-actions";
import { ErrorText } from "@/components/error-note";
import { SessionActionItems } from "@/components/orchestrate/session-actions";
import { Button } from "@/components/ui/button";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { LogView } from "@/components/workspace/log-view";
import { PanelIcon, PanelPane } from "@/components/workspace/panel-pane";
import { ServiceIcon } from "@/components/workspace/service-terminal";
import { armDrag, useTabDrag } from "@/components/workspace/tab-drag";
import { TerminalView } from "@/components/workspace/terminal-view";
import { openWorktreePicker } from "@/components/workspace/worktree-picker";
import { useLabel, useTone, WtChip } from "@/components/workspace/worktree-tone";
import { closePane, openBrowserAt, openPreviewAt, startSession } from "@/lib/actions";
import { agentLabel, agentOf, sessionAgent, sessionName, sessionState } from "@/lib/derive";
import { nameFromKey } from "@/lib/groups";
import { type Leaf, leaves, paneWorktree } from "@/lib/layout";
import { useChatPaneFocus } from "@/lib/focus-home";
import { PaneContext } from "@/lib/pane-context";
import { usePrefs } from "@/lib/prefs";
import { useRemoval } from "@/lib/removing";
import { useStore } from "@/lib/store";
import { startRenaming } from "@/lib/session-title";
import { memory, memoryNote } from "@/lib/processes";
import { focusPane, paneBeside, paneToTab, setPaneContent, splitKey, useWorkspaces, useWorktreeRef } from "@/lib/workspaces";
import { platformKeys } from "@/lib/platform";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s1: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": 0,
    "right": 0,
    "top": "0px",
    "zIndex": 30,
    "height": "2px",
  },
  s2: {
    "width": "12px",
    "height": "12px",
  },
  s3: {
    "display": "flex",
    "height": "28px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 50%, transparent)",
    "color": "var(--foreground)",
    "boxShadow": "inset 0 2px 0 var(--ring)",
  },
  s5: {
    "color": "var(--muted-foreground)",
  },
  s6: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
  },
  s7: {
    "opacity": 1,
  },
  s8: {
    "opacity": {
      "default": 0,
      ":focus-within": 1,
    },
    ":is(.group\\/header:hover &)": {
      "opacity": 1,
    },
  },
  s9: {
    "position": "relative",
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
  },
  s10: {
    "opacity": 0.85,
  },
  s11: {
    "opacity": 0.4,
  },
  s12: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s13: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s14: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "12px",
    "padding": "24px",
    "textAlign": "center",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s16: {
    "fontWeight": 500,
  },
  s17: {
    "alignItems": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": 20,
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "12px",
    "backgroundColor": "var(--background)",
    "padding": "24px",
    "textAlign": "center",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s19: {
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s20: {
    "fontWeight": 500,
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s23: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s24: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s25: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s26: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s27: {
    "width": "12px",
    "height": "12px",
  },
  s28: {
    "width": "12px",
    "height": "12px",
  },
  s29: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s30: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s31: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s32: {
    "width": "12px",
    "height": "12px",
  },
  s33: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "11px",
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
    "fontVariantNumeric": "tabular-nums",
  },
  s34: {
    "width": "12px",
    "height": "12px",
  },
  s35: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s36: {
    "width": "14px",
    "height": "14px",
  },
  s37: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s38: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s39: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s40: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s41: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s42: {
    "color": "var(--muted-foreground)",
  },
  s43: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },

  s44: {
    maxWidth: "28rem",
  },
  s45: {
    maxWidth: "20rem",
  },
  s46: {
    backgroundColor: { "[data-popup-open]": color.accent },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export { agentLabel };

// A File tab's pane and its editor load the first time one shows.
// An artifact or a worktree's board (components/art), loaded when first shown.
const ArtifactPane = lazy(() => import("@/components/art/artifact-pane").then((m) => ({ default: m.ArtifactPane })));
const ART_ICONS: Record<string, typeof ChartColumnIcon> = { chart: ChartColumnIcon, table: TableIcon, diagram: WorkflowIcon, page: AppWindowIcon, notes: FileTextIcon };

const FilePane = lazy(() => import("@/components/files/file-pane"));

interface Props {
  wsKey: string;
  tab: string;
  pane: Leaf;
  visible: boolean;
  focused: boolean;
  // More than one pane in the tab. Only then does a pane have its own
  // header; a lone pane's actions are in the tab strip.
  split: boolean;
  // The tab shows panes of more than one worktree: each header names its
  // pane's worktree in its colour.
  mixed?: boolean;
  // A side of a Compare tab: no header (the tab's bar names both sides),
  // and what inside it syncs with the other side knows which it is.
  compare?: CompareSide;
}

// Pane is one leaf of a tab's split tree: a terminal, a browser, a log or a
// plugin's panel, under a slim header when the tab is split.
export function Pane({ wsKey, tab, pane, visible, focused, split, mixed, compare }: Props) {
  // The worktree the pane belongs to: its own, in a tab that mixes
  // worktrees, else its tab's.
  const owner = paneWorktree(wsKey, pane);
  const info = useMemo(() => ({ wsKey, tab, pane: pane.id, worktree: owner }), [wsKey, tab, pane.id, owner]);
  const tone = useTone(mixed ? owner : undefined);
  // Named with its worktree for screen readers: "Claude Code, search-perf".
  const { label: worktreeName } = useLabel(owner);
  // A guest pane whose worktree was archived or removed: say so, and let it
  // be closed, rather than show a page or panel for nothing.
  const gone = useGuestGone(wsKey, pane);
  const focus = () => {
    if (!focused) focusPane(wsKey, tab, pane.id);
  };
  const close = () => void closePane(wsKey, tab, pane.id);
  const c = pane.content;
  const session = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));

  // Remember what runs here, so the pane can name it and start it again
  // once the session itself is gone.
  const agent = session ? agentOf(session) : undefined;
  const content = useRef<HTMLDivElement>(null);
  useChatPaneFocus(content, visible && focused && c.kind === "remote-chat");
  // Lifted: being dragged by its header, so it fades while it moves.
  const lifted = useTabDrag((s) => s.source?.kind === "pane" && s.source.pane === pane.id);
  useEffect(() => {
    if (c.kind !== "terminal" || !session) return;
    const title = session.title?.trim() || undefined;
    if (c.agent !== agent || c.command !== session.command || c.title !== title) setPaneContent(wsKey, tab, pane.id, { ...c, agent, command: session.command, title });
  }, [c, session, agent, wsKey, tab, pane.id]);

  return (
    <PaneContext.Provider value={info}>
      <CompareSideContext.Provider value={compare}>
      <div role="region" aria-label={`${paneLabel(c, agent)}, ${worktreeName}`} className={sx(paint.s0)} onMouseDownCapture={focus}>
        {/* A Compare tab's side has no header: its focus line is its own. */}
        {compare && focused && tone && <span aria-hidden className={sx(paint.s1)} style={{ background: tone }} />}
        {split && (
          // Its header drags the pane beside another, or onto the tab strip as
          // a tab of its own (tab-drag.tsx). Zen has no strip: there it only
          // moves beside another pane. In a tab that mixes worktrees, it names
          // the pane's worktree, and the focus line is in that one's colour.
          <div
            onPointerDown={(e) => armDrag(e, { kind: "pane", key: wsKey, tab, pane: pane.id }, (c.kind === "terminal" && (session?.title?.trim() || c.title)) || paneLabel(c, agent), <PaneIcon content={c} agent={agent} className={sx(paint.s2)} />)}
            className={[[sx(paint.s3), "group/header"].filter(Boolean).join(" "), focused ? sx(paint.s4) : sx(paint.s5)].filter(Boolean).join(" ")}
            style={tone ? { boxShadow: focused ? `inset 0 2px 0 ${tone}` : `inset 0 1px 0 color-mix(in oklab, ${tone} 50%, transparent)` } : undefined}
          >
            {tone && <WtChip wsKey={owner} />}
            <PaneTitle pane={pane} />
            <div className={[sx(paint.s6), focused ? sx(paint.s7) : sx(paint.s8)].filter(Boolean).join(" ")}>
              <PaneActions wsKey={wsKey} tab={tab} pane={pane} onClose={close} closable focused={focused} />
            </div>
          </div>
        )}
        <div ref={content} className={[sx(paint.s9), split && !focused && sx(paint.s10), lifted && sx(paint.s11)].filter(Boolean).join(" ")}>
          {gone && <GonePane name={gone} onClose={close} />}
          {c.kind === "remote-chat" && <RemoteChatPane box={c.box} id={c.chat} cwd={c.cwd} agent={c.agent} draft={c.draft} options={c.options} onSaved={(saved) => setPaneContent(wsKey, tab, pane.id, { ...c, ...saved })} />}
          {c.kind === "terminal" && (
            // Shells show typing before the box echoes it on a slow link.
            // An agent draws its own input, so it gets no predictive echo.
            <TerminalView box={c.box} session={c.session} agent={c.agent} command={c.command} wsKey={wsKey} tab={tab} pane={pane.id} visible={visible} focused={focused} predict={!c.agent && !agent} onFocus={focus} onClose={close} />
          )}
          {c.kind === "browser" && <BrowserPane id={pane.id} url={c.url} visible={visible} worktree={owner} onNavigate={(url) => setPaneContent(wsKey, tab, pane.id, { kind: "browser", url })} onLoading={compare ? (l) => pageLoading(pane.id, l) : undefined} />}
          {c.kind === "preview" && <PreviewPane url={c.url} visible={visible} worktree={owner} onNavigate={(url) => setPaneContent(wsKey, tab, pane.id, { kind: "preview", url })} />}
          {c.kind === "file" && (
            <Suspense fallback={<div className={sx(paint.s12)}><Spinner  size="lg" muted/></div>}>
              <FilePane path={c.path} owner={owner} visible={visible} onClose={close} />
            </Suspense>
          )}
          {c.kind === "artifact" && (
            <Suspense fallback={<div className={sx(paint.s13)} />}>
              <ArtifactPane id={c.id} focus={c.focus} />
            </Suspense>
          )}
          {c.kind === "empty" && <EmptySide owner={owner} tab={tab} pane={pane.id} label={c.label} />}
          {c.kind === "log" && <LogView box={c.box} location={c.location} worktree={c.worktree} service={c.service} visible={visible} />}
          {c.kind === "panel" && <PanelPane wsKey={owner} plugin={c.plugin} panel={c.panel} />}
          {c.kind === "starting" && (
            <div className={sx(paint.s14)}>
              <Spinner  size="lg"/>
              Starting {c.label}…
            </div>
          )}
          {c.kind === "error" && (
            <div className={sx(paint.s15)}>
              <p className={sx(paint.s16)}>Couldn't start it</p>
              <ErrorText className={[sx(paint.s17), sx(paint.s44)].filter(Boolean).join(" ")} text={c.message} />
              <Button size="sm" variant="outline" onClick={close}>
                Close pane
              </Button>
            </div>
          )}
        </div>
      </div>
      </CompareSideContext.Provider>
    </PaneContext.Provider>
  );
}

// useGuestGone is the name of a guest pane's worktree once its box no
// longer lists it (archived or removed), else undefined. A pane of the
// tab's own worktree goes with its tab, so only guests can be left behind.
function useGuestGone(wsKey: string, pane: Leaf): string | undefined {
  const wt = pane.wt && pane.wt !== wsKey ? pane.wt : undefined;
  const ref = useWorktreeRef(wt);
  const listed = useStore((s) => (wt ? !!s.boxes[splitKey(wt).box]?.locations : false));
  const leaving = useRemoval(wt ? splitKey(wt).box : "", wt ? splitKey(wt).path : undefined);
  return wt && listed && !ref && !leaving ? nameFromKey(wt) : undefined;
}

// GonePane stands in for a guest pane whose worktree was archived.
function GonePane({ name, onClose }: { name: string; onClose(): void }) {
  return (
    <div className={sx(paint.s18)}>
      <ArchiveIcon className={sx(paint.s19)} />
      <p className={sx(paint.s20)}>{name} was archived</p>
      <p className={[sx(paint.s21), sx(paint.s45)].filter(Boolean).join(" ")}>Its agents stopped with it, so there is nothing left to show here.</p>
      <Button size="sm" variant="outline" onClick={onClose}>
        Close pane
      </Button>
    </div>
  );
}

// paneLabel is what a pane is called in headers and tabs: the agent's name,
// "Shell", "Browser", or the plugin panel's title.
export function paneLabel(c: Leaf["content"], agent?: string): string {
  switch (c.kind) {
    case "remote-chat":
      return `${agentLabel(c.agent ?? "codex")} chat`;
    case "terminal":
      return agent || c.agent ? agentLabel((agent ?? c.agent)!) : "Shell";
    case "browser":
      return "Browser";
    case "preview":
      return "Preview";
    case "file":
      return c.path.slice(c.path.lastIndexOf("/") + 1);
    case "log":
      return `${c.service} log`;
    case "artifact":
      return c.id ? c.title || "Artifact" : "Artifacts";
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
  const service = useStore((s) => c.kind === "terminal" && !!s.boxes[c.box]?.sessions?.find((x) => x.name === c.session)?.service);
  if (c.kind === "remote-chat") return <AgentIcon agent={c.agent ?? "codex"} className={className} />;
  if (c.kind === "browser") return <GlobeIcon className={[sx(paint.s22), className].filter(Boolean).join(" ")} />;
  if (c.kind === "file") return <FileGlyph path={c.path} className={className} />;
  if (c.kind === "preview") return <MonitorSmartphoneIcon className={[sx(paint.s23), className].filter(Boolean).join(" ")} />;
  if (c.kind === "artifact") {
    const Icon = c.id ? (ART_ICONS[c.art ?? ""] ?? ChartColumnIcon) : LayoutGridIcon;
    return <Icon className={[sx(paint.s24), className].filter(Boolean).join(" ")} />;
  }
  if (c.kind === "log") return <ScrollTextIcon className={[sx(paint.s25), className].filter(Boolean).join(" ")} />;
  if (c.kind === "panel") return <PanelIcon plugin={c.plugin} panel={c.panel} className={[sx(paint.s26), className].filter(Boolean).join(" ")} />;
  if (service) return <ServiceIcon className={[sx(paint.s27), className].filter(Boolean).join(" ")} />;
  return <AgentIcon agent={agent ?? (c.kind === "terminal" ? c.agent : undefined)} className={[sx(paint.s28), className].filter(Boolean).join(" ")} />;
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
  // Near the box's per-session memory ceiling: said here and in its chat.
  const near = away ? undefined : memoryNote(session?.usage);
  return (
    <Tip label={c.kind === "terminal" ? `${c.session} on ${c.box}${away ? ` · ${c.box} is offline` : ""}${near ? ` · ${near}` : ""}` : undefined} align="start">
      <span className={sx(paint.s29)}>
        <PaneIcon content={c} agent={agent} />
        <span className={sx(paint.s30)}>{label}</span>
        {secondary && <span className={sx(paint.s31)}>{secondary}</span>}
        {state && <StateGlyph state={state} className={sx(paint.s32)} />}
        {near && session?.usage && (
          <span data-testid="pane-memory" className={sx(paint.s33)}>
            <GaugeIcon className={sx(paint.s34)} aria-hidden />
            {memory(session.usage.memory)} of {memory(session.usage.memory_high ?? 0)}
          </span>
        )}
      </span>
    </Tip>
  );
}

// PaneActions are a pane's split buttons and its ⋯ menu: in the pane's own
// header when the tab is split, and in the tab strip when it is not.
// ⌘W and ⌘D act on the focused pane, so only its buttons name them.
// compact (a tiny window's strip) keeps the ⋯ menu and drops the split
// buttons; ⌘D and ⌘⇧D still split.
export function PaneActions({ wsKey, tab, pane, onClose, closable, focused = true, compact }: { wsKey: string; tab: string; pane: Leaf; onClose?: () => void; closable?: boolean; focused?: boolean; compact?: boolean }) {
  const c = pane.content;
  const session = useStore((s) => (c.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  const agent = session && agentOf(session);
  const close = onClose ?? (() => void closePane(wsKey, tab, pane.id));
  const labs = usePrefs((p) => p.labs);
  const beside = (dir: "row" | "col") => ({ kind: "split" as const, tab, pane: pane.id, dir });
  // The tab's other panes, for moving this one out or swapping it.
  const others = useWorkspaces((s) => {
    const t = s.spaces[wsKey]?.tabs.find((x) => x.id === tab);
    return t ? leaves(t.root).filter((l) => l.id !== pane.id).map((l) => l.id).join(" ") : "";
  })
    .split(" ")
    .filter(Boolean);

  return (
    <>
      {!compact && (
        <>
          <HeaderButton label="Split right" keys={focused ? "⌘D" : undefined} onClick={() => void startSession("", beside("row"))}>
            <SquareSplitHorizontalIcon />
          </HeaderButton>
          <HeaderButton label="Split down" keys={focused ? "⌘⇧D" : undefined} onClick={() => void startSession("", beside("col"))}>
            <SquareSplitVerticalIcon />
          </HeaderButton>
        </>
      )}
      <Menu>
        <Tip label="Pane actions">
          <MenuTrigger render={<button type="button" aria-label="Pane actions" className={[sx(paint.s35), sx(paint.s46)].filter(Boolean).join(" ")} />}>
            <EllipsisIcon className={sx(paint.s36)} />
          </MenuTrigger>
        </Tip>
        <MenuPopup align="end" width={menuWidths.w56}>
          {c.kind === "terminal" && agent && (
            <>
              <SessionActionItems box={c.box} session={c.session} />
              <MenuSeparator />
            </>
          )}
          <MenuGroup>
            <MenuGroupLabel>Open beside</MenuGroupLabel>
            <MenuItem onClick={() => void startSession("", beside("row"))}>
              <span className={sx(paint.s37)}>
                <AgentIcon />
              </span>
              Shell
            </MenuItem>
            <MenuItem onClick={() => openBrowserAt("", beside("row"))}>
              <span className={sx(paint.s38)}>
                <GlobeIcon />
              </span>
              Browser
            </MenuItem>
            <MenuItem onClick={() => openPreviewAt("", beside("row"))}>
              <span className={sx(paint.s39)}>
                <MonitorSmartphoneIcon />
              </span>
              Preview
            </MenuItem>
            {labs && (
              <MenuItem
                onClick={() => {
                  focusPane(wsKey, tab, pane.id);
                  openWorktreePicker({ kind: "split" });
                }}
              >
                <span className={sx(paint.s40)}>
                  <Columns2Icon />
                </span>
                Another worktree…
                {focused && <MenuShortcut>⌘⌥D</MenuShortcut>}
              </MenuItem>
            )}
          </MenuGroup>
          <MenuSeparator />
          {c.kind === "terminal" && session && (
            <MenuItem onClick={() => startRenaming(c.box, c.session)}>
              <PencilIcon />
              Rename…
            </MenuItem>
          )}
          {others.length > 0 && (
            <>
              <MenuItem onClick={() => paneToTab(wsKey, tab, pane.id)}>
                <AppWindowIcon />
                Move to a new tab
              </MenuItem>
              {others.length === 1 && (
                <MenuItem onClick={() => paneBeside(wsKey, tab, pane.id, others[0], "center")}>
                  <ArrowLeftRightIcon />
                  Swap with the other pane
                </MenuItem>
              )}
            </>
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
        <span className={sx(paint.s41)}>
          {label}
          {keys && <span className={sx(paint.s42)}>{platformKeys(keys)}</span>}
        </span>
      }
    >
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={sx(paint.s43)}
      >
        {children}
      </button>
    </Tip>
  );
}
