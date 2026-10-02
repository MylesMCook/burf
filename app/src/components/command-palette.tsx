import {
  BellIcon,
  BookMarkedIcon,
  CodeXmlIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CodeIcon,
  FolderPlusIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GlobeIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PanelTopIcon,
  PuzzleIcon,
  RefreshCwIcon,
  ServerIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SquareTerminalIcon,
  PackageIcon,
  PackagePlusIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { isMock } from "@/hooks/use-berth-connection";
import { openAddKit } from "@/views/kits/kits-store";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { openEditor } from "@/components/editors/open";
import { Kbd } from "@/components/ui/kbd";
import { useAllSessions } from "@/hooks/use-agent-counts";
import { useThemes } from "@/hooks/use-theme";
import { openBrowserAt, resolveUrl, startSession } from "@/lib/actions";
import { agentLabel, agentOf, sortedWorktrees, worktreeOf } from "@/lib/derive";
import { around, groupMatches, historyTitle, type MatchGroup, searchHistory } from "@/lib/history";
import { openBroadcast, openPromptPicker } from "@/lib/prompts";
import { setNotificationsOpen } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import { currentSpace, focusSession, recentWorktrees, refOf, selectWorktree, useWorkspaces } from "@/lib/workspaces";
import { openCustomize, useArrangedNav } from "@/components/sidebar/nav";
import { loadPlugins } from "@/plugins/host";
import { useRegistry } from "@/plugins/registry";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { Marked, SessionChips, SourceIcon } from "@/views/history/parts";

interface Item {
  value: string;
  label: string;
  detail?: string;
  // Also matched when searching, without being shown.
  search?: string;
  icon?: React.ReactNode;
  // Shown at the right: a shortcut, or a theme's swatches.
  shortcut?: string;
  trailing?: React.ReactNode;
  // Highlighting a theme previews it.
  theme?: string;
  // Shown instead of the label and detail.
  render?: React.ReactNode;
  run(): void;
}

interface Group {
  value: string;
  label?: React.ReactNode;
  items: Item[];
}

const slot = (icon: React.ReactNode) => <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">{icon}</span>;

// CommandPalette (⌘K) jumps anywhere: sessions, worktrees, views, themes,
// and whatever commands plugins add. Empty, it shows what needs you and
// where you were; with a query that matches nothing, it offers to make it.
export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const sessions = useAllSessions();
  const boxes = useStore((s) => s.boxes);
  const status = useStore((s) => s.status);
  const themeId = useStore((s) => s.themeId);
  const spaces = useWorkspaces((s) => s.spaces);
  const themes = useThemes();
  const pluginCommands = useRegistry((s) => s.commands);
  const nav = useArrangedNav();
  const [query, setQuery] = useState("");
  // "?" searches agent history on every box.
  const historyQ = query.startsWith("?") ? query.replace(/^\?+/, "").trim() : undefined;
  const [history, setHistory] = useState<{ q: string; groups?: MatchGroup[]; error?: string }>({ q: "" });
  useEffect(() => {
    if (!historyQ) return;
    let stop = false;
    const t = setTimeout(() => {
      searchHistory(historyQ, { limit: 40 })
        .then((r) => !stop && setHistory({ q: historyQ, groups: groupMatches(r.items), error: r.items.length ? undefined : r.failed[0]?.error }))
        .catch((err) => !stop && setHistory({ q: historyQ, error: String(err) }));
    }, 250);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [historyQ]);
  // The theme in use when the palette opened, to put back after a preview.
  const before = useRef<string | undefined>(undefined);

  const close = (keepTheme = false) => {
    if (!keepTheme && before.current && useStore.getState().themeId !== before.current) useStore.getState().setTheme(before.current);
    before.current = undefined;
    setQuery("");
    setOpen(false);
  };

  const groups = useMemo<Group[]>(() => {
    const st = useStore.getState();
    const go = (fn: () => void) => () => {
      close(true);
      fn();
    };
    const q = query.trim();

    if (historyQ !== undefined) {
      const all: Item = {
        value: "history:all",
        label: historyQ ? `See every match for “${historyQ}” in History` : "Open History",
        icon: slot(<HistoryIcon />),
        run: go(() => st.setView({ kind: "history", q: historyQ || undefined })),
      };
      if (!historyQ) return [{ value: "Search agent history: type what to find", items: [all] }];
      const current = history.q === historyQ ? history.groups : undefined;
      const found: Group[] = (current ?? []).slice(0, 8).map((g) => ({
        value: `${g.box}:${g.session.id}`,
        label: (
          <span className="flex min-w-0 items-center gap-1.5 normal-case">
            <SourceIcon s={g.session} className="size-3" />
            <span className="truncate">{historyTitle(g.session)}</span>
            <SessionChips box={g.box} s={g.session} />
          </span>
        ),
        items: g.matches.slice(0, 4).map((m, i) => ({
          value: `history:${g.box}:${g.session.id}:${i}`,
          label: m.line,
          render: <Marked className="min-w-0 truncate font-mono text-xs" text={around(m.line, historyQ)} q={historyQ} />,
          run: go(() => st.setView({ kind: "history", q: historyQ, open: { box: g.box, id: g.session.id, at: m.screen ? -1 - m.position : m.position } })),
        })),
      }));
      const note = current === undefined ? "Searching…" : history.error ? history.error : !found.length ? "No matches" : "History";
      return [...found, { value: note, items: [all] }];
    }

    const actions: Item[] = [
      { value: "new-worktree", label: "New worktree…", icon: slot(<GitBranchPlusIcon />), shortcut: "⌘N", run: go(() => st.openNewWorktree()) },
      { value: "new-terminal", label: "New terminal", icon: slot(<SquareTerminalIcon />), shortcut: "⌘T", run: go(() => void startSession("")) },
      { value: "new-browser", label: "New browser tab", icon: slot(<GlobeIcon />), shortcut: "⌘⇧B", run: go(() => openBrowserAt("")) },
      { value: "open in editor cursor vscode zed", label: "Open in editor", icon: slot(<CodeXmlIcon />), shortcut: "⌘⇧O", run: go(() => {
        const ws = currentSpace();
        if (ws) void openEditor({ box: ws.ref.box, path: ws.ref.path });
      }) },
      { value: "new-tab", label: "New tab…", icon: slot(<PanelTopIcon />), run: go(() => st.setNewTabMenuOpen(true)) },
      { value: "send saved prompt library", label: "Send a saved prompt…", icon: slot(<BookMarkedIcon />), run: go(() => openPromptPicker()) },
      { value: "broadcast prompt several agents", label: "Send a prompt to several agents…", icon: slot(<UsersIcon />), run: go(() => openBroadcast()) },
      { value: "add-location", label: "Add a project…", icon: slot(<FolderPlusIcon />), run: go(() => st.openAddProject()) },
      { value: "dashboard", label: "Agent Dashboard", icon: slot(<LayoutDashboardIcon />), shortcut: "⌘J", run: go(() => st.setView({ kind: "dashboard" })) },
      { value: "notifications inbox bell", label: "Notifications", icon: slot(<BellIcon />), shortcut: "⌘⇧N", run: go(() => setNotificationsOpen(true)) },
      { value: "notification settings do not disturb", label: "Notification settings", icon: slot(<BellIcon />), run: go(() => st.setView({ kind: "settings", section: "notifications" })) },
      { value: "worktrees", label: "Worktrees", icon: slot(<GitBranchIcon />), run: go(() => st.setView({ kind: "worktrees" })) },
      { value: "search agent history transcripts", label: "Search agent history…", icon: slot(<HistoryIcon />), shortcut: "?", run: () => setQuery("?") },
      { value: "automations", label: "Automations", icon: slot(<WorkflowIcon />), run: go(() => st.setView({ kind: "automations" })) },
      { value: "kits", label: "Kits", icon: slot(<PackageIcon />), run: go(() => st.setView({ kind: "kits" })) },
      { value: "add kit from link", label: "Add a kit from a link…", icon: slot(<PackagePlusIcon />), run: go(() => openAddKit()) },
      { value: "settings", label: "Settings", icon: slot(<SettingsIcon />), run: go(() => st.setView({ kind: "settings" })) },
      { value: "add-box", label: "Add a box…", icon: slot(<ServerIcon />), run: go(openAddBox) },
      { value: "settings-developer", label: "Developer settings", icon: slot(<CodeIcon />), run: go(() => st.setView({ kind: "settings", section: "developer" })) },
      { value: "customize-sidebar", label: "Customize sidebar…", icon: slot(<SlidersHorizontalIcon />), run: go(() => openCustomize()) },
      { value: "refresh", label: "Refresh everything", icon: slot(<RefreshCwIcon />), run: go(() => void st.refreshAll()) },
      { value: "reload-plugins", label: "Reload plugins", icon: slot(<PuzzleIcon />), run: go(() => st.client && void loadPlugins(st.client)) },
    ];
    // Demo mode plays what agents on boxes do, to see the app react.
    const ws = currentSpace();
    if (isMock()) {
      actions.push({ value: "mock demo notifications every kind", label: "Demo: one of every notification", icon: slot(<BellIcon />), run: go(() => void import("@/lib/mock").then((m) => m.mockNotifications())) });
    }
    if (isMock() && ws) {
      const where = ws.ref.main ? ws.ref.location : `${ws.ref.location}/${ws.ref.worktree}`;
      for (const how of ["split", "tab"] as const) {
        actions.push({
          value: `mock agent opens ${how}`,
          label: `Demo: an agent opens Claude Code in a ${how} here`,
          icon: slot(<CodeIcon />),
          run: go(() => void import("@/lib/mock").then((m) => m.mockAgentOpens(ws.ref.box, where, ws.ref.path, how))),
        });
      }
    }

    // Sessions are named by where they run, so two "main" branches in
    // different repositories cannot be confused.
    const sessionItem = ({ box, session, state }: (typeof sessions)[number]): Item => {
      const where = worktreeOf(boxes[box]?.locations, session);
      const place = where ? (where.worktree.main ? where.location.name : `${where.location.name} / ${where.worktree.name}`) : (session.location ?? session.name);
      const agent = agentOf(session);
      return {
        value: `session:${box}/${session.name}`,
        label: `${place} · ${agent ? agentLabel(agent) : "Shell"}`,
        detail: [where?.worktree.branch, box].filter(Boolean).join(" · "),
        search: session.name,
        icon: (
          <span className="flex w-8 shrink-0 items-center gap-1">
            <AgentIcon agent={agent} />
            <StateGlyph state={state} className="size-3" />
          </span>
        ),
        run: go(() => void focusSession(box, session.name)),
      };
    };

    const online = status?.boxes.filter((b) => b.state === "online").map((b) => b.name) ?? [];
    const worktreeItems: Item[] = online.flatMap((box) =>
      (boxes[box]?.locations ?? []).flatMap((loc) =>
        sortedWorktrees(loc).map((wt) => ({
          value: `wt:${box}:${wt.path}`,
          label: wt.main ? loc.name : `${loc.name} / ${wt.name}`,
          detail: [wt.branch, box].filter(Boolean).join(" · "),
          icon: slot(<GitBranchIcon />),
          run: go(() => selectWorktree(refOf(box, loc, wt))),
        })),
      ),
    );

    const themeItems: Item[] = themes.map((t) => ({
      value: `theme:${t.id}`,
      label: t.name,
      search: "theme",
      theme: t.id,
      icon: slot(t.id === (before.current ?? themeId) ? <CheckIcon /> : null),
      trailing: (
        <span className="ml-auto flex shrink-0 overflow-hidden rounded-sm border">
          {[t.colors.background, t.colors.sidebar, t.terminal.blue, t.terminal.green].map((c, i) => (
            <span key={i} className="size-3" style={{ background: c }} />
          ))}
        </span>
      ),
      run: go(() => st.setTheme(t.id)),
    }));

    const pluginItems: Item[] = pluginCommands.map(({ plugin, item }) => ({
      value: `plugin:${plugin}:${item.id}`,
      label: item.title,
      detail: item.group ?? plugin,
      icon: slot(<PuzzleIcon />),
      shortcut: item.shortcut,
      run: go(() => {
        try {
          void Promise.resolve(item.run()).catch((err) => console.error(`plugin ${plugin}: ${item.id} failed`, err));
        } catch (err) {
          console.error(`plugin ${plugin}: ${item.id} failed`, err);
        }
      }),
    }));

    // Places hidden from the sidebar stay reachable here.
    const hiddenPlaces: Item[] = nav.hidden.map((n) => ({
      value: `place:${n.id}`,
      label: n.label,
      detail: "Hidden from sidebar",
      icon: slot(n.icon),
      run: go(() => st.setView(n.view)),
    }));

    if (!q) {
      const waiting = sessions.filter((s) => s.state === "waiting").map(sessionItem);
      const recent: Item[] = recentWorktrees(spaces, 5).map((w) => ({
        value: `recent:${w.ref.box}:${w.ref.path}`,
        label: w.ref.main ? w.ref.location : `${w.ref.location} / ${w.ref.worktree}`,
        detail: w.ref.box,
        icon: slot(<GitBranchIcon />),
        run: go(() => selectWorktree(w.ref)),
      }));
      return [
        { value: "Needs you", items: waiting },
        { value: "Recent", items: recent },
        { value: "Actions", items: actions },
      ].filter((g) => g.items.length);
    }

    // Searching: everything, and ways to make what is not there.
    const url = resolveUrl(q);
    const make: Item[] = [
      ...(url ? [{ value: `open:${url}`, label: `Open ${q} in a browser tab`, detail: url, icon: slot(<ArrowUpRightIcon />), run: go(() => openBrowserAt(url)) }] : []),
      { value: `new-worktree:${q}`, label: `New worktree "${q}"`, icon: slot(<GitBranchPlusIcon />), run: go(() => st.openNewWorktree({ name: q })) },
    ];
    return [
      { value: "Sessions", items: sessions.map(sessionItem) },
      { value: "Worktrees", items: worktreeItems },
      { value: "Actions", items: actions },
      { value: "Plugins", items: pluginItems },
      { value: "Themes", items: themeItems },
      { value: "Hidden from sidebar", items: hiddenPlaces },
      { value: "Make it", items: make },
    ].filter((g) => g.items.length);
    // close is stable enough: it only reads refs and store setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, boxes, status, themes, themeId, spaces, pluginCommands, query, nav.hidden, historyQ, history]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        if (o) setOpen(true);
        else close();
      }}
    >
      <CommandDialogPopup>
        <Command
          items={groups}
          value={query}
          onValueChange={setQuery}
          filter={historyQ !== undefined ? null : undefined}
          itemToStringValue={(i: unknown) => `${(i as Item).label} ${(i as Item).detail ?? ""} ${(i as Item).search ?? ""}`}
          onItemHighlighted={(i: unknown) => {
            // Highlighting a theme previews it; closing without choosing puts
            // the old one back.
            const t = (i as Item | undefined)?.theme;
            if (!t) return;
            before.current ??= useStore.getState().themeId;
            useStore.getState().setTheme(t);
          }}
        >
          <CommandInput placeholder="Jump to a session, worktree, or command… (? searches history)" />
          <CommandPanel>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandList>
              {(group: Group) => (
                <CommandGroup key={group.value} items={group.items}>
                  <CommandGroupLabel>{group.label ?? group.value}</CommandGroupLabel>
                  <CommandCollection>
                    {(item: Item) => (
                      <CommandItem key={item.value} value={item} className="gap-2" onClick={() => item.run()}>
                        {item.icon}
                        {item.render ?? <span className="truncate">{item.label}</span>}
                        {item.detail && <span className="ml-auto min-w-0 shrink truncate text-muted-foreground text-xs">{item.detail}</span>}
                        {item.trailing}
                        {item.shortcut && <Kbd className={item.detail ? "" : "ml-auto"}>{item.shortcut}</Kbd>}
                      </CommandItem>
                    )}
                  </CommandCollection>
                </CommandGroup>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter className="text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move, <Kbd>↵</Kbd> to open
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> to close
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
