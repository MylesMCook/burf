import {
  ActivityIcon,
  ArrowUpCircleIcon,
  ArrowUpRightIcon,
  BotIcon,
  CodeXmlIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GlobeIcon,
  HomeIcon,
  LinkIcon,
  PlayIcon,
  RotateCwIcon,
  Settings2Icon,
  SquareIcon,
  SquareTerminalIcon,
  StethoscopeIcon,
  Trash2Icon,
  UnplugIcon,
  WorkflowIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { EditorMenuItems } from "@/components/editors/editor-menu";
import { SessionActionItems } from "@/components/orchestrate/session-actions";
import { confirm, copy } from "@/components/sidebar/confirm";
import { ContextMenu, ContextMenuPopup, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuSub, MenuSubPopup, MenuSubTrigger, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { agentPresets, openBrowserAt, startSession, stopSession } from "@/lib/actions";
import { boxApi, type BoxStatus, laptopApi, type Location, type Worktree, type WorktreeService } from "@/lib/api";
import { portUrl } from "@/lib/browser-url";
import { agentOf, worktreeSessions } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { scheduleRefresh, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { refOf, selectWorktree } from "@/lib/workspaces";
import { useRegistry } from "@/plugins/registry";

// The sidebar's actions are defined once and drawn into either menu: the
// ⋯ button on a row, or the row's right-click menu. Both show the same
// items in the same order, with what removes things last and in red, each
// behind a confirmation that names what it removes.

export type Action =
  | { type: "item"; label: string; icon?: ReactNode; shortcut?: string; hint?: string; destructive?: boolean; disabled?: boolean; run(): void }
  | { type: "sub"; label: string; icon?: ReactNode; items: Action[] | (() => ReactNode) }
  | { type: "label"; label: string }
  | { type: "sep" }
  | { type: "node"; node: ReactNode };

const item = (label: string, icon: ReactNode, run: () => void, more: Partial<Extract<Action, { type: "item" }>> = {}): Action => ({ type: "item", label, icon, run, ...more });
const sep: Action = { type: "sep" };

// ActionItems draws actions as menu items; it works inside a Menu or a
// ContextMenu, which share their parts.
export function ActionItems({ items }: { items: Action[] }) {
  return (
    <>
      {items.map((a, i) => {
        switch (a.type) {
          case "sep":
            return <MenuSeparator key={i} />;
          case "label":
            // Base UI requires a group label inside a group.
            return (
              <MenuGroup key={i}>
                <MenuGroupLabel className="px-2 pt-1 pb-0.5">{a.label}</MenuGroupLabel>
              </MenuGroup>
            );
          case "node":
            return <span key={i}>{a.node}</span>;
          case "sub":
            return (
              <MenuSub key={i}>
                <MenuSubTrigger>
                  {a.icon}
                  {a.label}
                </MenuSubTrigger>
                <MenuSubPopup className="min-w-48">{typeof a.items === "function" ? a.items() : <ActionItems items={a.items} />}</MenuSubPopup>
              </MenuSub>
            );
          default:
            return (
              <MenuItem key={i} variant={a.destructive ? "destructive" : "default"} disabled={a.disabled} onClick={a.run}>
                {a.icon}
                <span className="flex-1">{a.label}</span>
                {a.hint && <span className="text-muted-foreground text-xs">{a.hint}</span>}
                {a.shortcut && <Kbd className="ml-2">{a.shortcut}</Kbd>}
              </MenuItem>
            );
        }
      })}
    </>
  );
}

// DotsMenu is the ⋯ button for a row.
export function DotsMenu({ label, items }: { label: string; items: () => Action[] }) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground data-popup-open:bg-sidebar-accent [&_svg]:size-3.5"
          />
        }
      >
        <EllipsisIcon />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-56">
        <ActionItems items={items()} />
      </MenuPopup>
    </Menu>
  );
}

// ContextRow gives a row a right-click menu. The row looks selected while
// its menu is open, and Shift+F10 or the menu key opens it from the
// keyboard on a focused row.
export function ContextRow({ items, children, className }: { items: () => Action[]; children: ReactNode; className?: string }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn("block rounded-md data-popup-open:bg-sidebar-accent", className)}
        onKeyDown={(e) => {
          if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
          e.preventDefault();
          const el = e.currentTarget as HTMLElement;
          const r = (document.activeElement as HTMLElement | null)?.getBoundingClientRect() ?? el.getBoundingClientRect();
          el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 24, clientY: r.top + r.height / 2, button: 2 }));
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuPopup className="min-w-56">
        <ActionItems items={items()} />
      </ContextMenuPopup>
    </ContextMenu>
  );
}

const slot = (icon: ReactNode) => <span className="flex size-4 items-center justify-center">{icon}</span>;

function urlFor(box: string, loc: Location, wt: Worktree) {
  const st = useStore.getState();
  const services = st.boxes[box]?.services ?? [];
  const port = services
    .filter((s) => s.path === wt.path)
    .map((s) => s.port)
    .sort((a, b) => a - b)[0];
  return port ? portUrl(port, { ref: refOf(box, loc, wt), services, urlPort: st.status?.proxy.url_port }) : undefined;
}

// worktreeActions is everything a worktree row offers.
export function worktreeActions(box: string, loc: Location, wt: Worktree): Action[] {
  const st = useStore.getState();
  const sessions = worktreeSessions(st.boxes[box]?.sessions, wt).filter((s) => !s.exited);
  const agentSession = sessions.find((s) => agentOf(s));
  const url = urlFor(box, loc, wt);
  const name = wt.main ? loc.name : wt.name;
  const select = () => selectWorktree(refOf(box, loc, wt));
  const presets = agentPresets(box, loc);

  const items: Action[] = [
    item("Open", wt.main ? <HomeIcon /> : <GitBranchIcon />, select),
    item("New terminal", <SquareTerminalIcon />, () => {
      select();
      void startSession("");
    }),
    {
      type: "sub",
      label: "New agent",
      icon: <BotIcon />,
      items: presets.map((p) =>
        item(p.name, slot(<AgentIcon agent={p.id} />), () => {
          select();
          void startSession(p.command, { kind: "tab" }, p.name);
        }),
      ),
    },
    { type: "sub", label: "Run", icon: <PlayIcon />, items: () => <RunItems box={box} loc={loc} wt={wt} /> },
    item(url ? "Open dev server in browser tab" : "New browser tab", <GlobeIcon />, () => {
      select();
      openBrowserAt(url ?? "");
    }),
    { type: "sub", label: "Open in", icon: <CodeXmlIcon />, items: () => <EditorMenuItems box={box} path={wt.path} /> },
  ];
  if (agentSession) items.push({ type: "sub", label: "Orchestrate", icon: <WorkflowIcon />, items: () => <SessionActionItems box={box} session={agentSession.name} /> });
  items.push(sep, item("Copy path", <CopyIcon />, () => copy(wt.path, "path")));
  if (wt.branch) items.push(item("Copy branch", <GitBranchIcon />, () => copy(wt.branch!, "branch name")));
  if (url) items.push(item("Copy URL", <LinkIcon />, () => copy(url, "URL")));

  const danger: Action[] = [];
  if (sessions.length > 0) {
    danger.push(
      item(`Stop ${sessions.length === 1 ? "its session" : `all ${sessions.length} sessions`}…`, <SquareIcon />, () =>
        confirm({
          title: `Stop everything in ${name}?`,
          description: `${sessions.length === 1 ? "Its session stops" : `All ${sessions.length} sessions stop`}, agents included. Their work stays in the worktree.`,
          detail: sessions.map((s) => s.name).join("\n"),
          confirm: "Stop sessions",
          destructive: true,
          run: async () => {
            for (const s of sessions) await stopSession(box, s.name, true);
          },
        }),
        { destructive: true },
      ),
    );
  }
  if (!wt.main) danger.push(item("Remove worktree…", <Trash2Icon />, () => removeWorktree(box, loc, wt), { destructive: true }));
  if (danger.length) items.push(sep, ...danger);
  return items;
}

function removeWorktree(box: string, loc: Location, wt: Worktree) {
  confirm({
    title: `Remove ${wt.name}?`,
    description: `Its folder on ${box} is deleted. The repository's teardown script runs first, and the worktree's services and sessions stop.`,
    detail: (
      <>
        {wt.path}
        {wt.branch && (
          <>
            <br />
            branch {wt.branch}
          </>
        )}
      </>
    ),
    confirm: "Remove worktree",
    destructive: true,
    options: [
      ...(wt.branch ? [{ id: "branch", label: `Also delete branch ${wt.branch}` }] : []),
      { id: "force", label: "Remove even with uncommitted changes", hint: "Without this, git refuses when there is work it would lose." },
    ],
    run: async (checked) => {
      const client = useStore.getState().client;
      if (!client) throw new Error("not connected");
      const q = new URLSearchParams({ ...(checked.force ? { force: "1" } : {}), ...(checked.branch ? { delete_branch: "1" } : {}) }).toString();
      try {
        await client.box(box, "DELETE", `locations/${encodeURIComponent(loc.name)}/worktrees/${encodeURIComponent(wt.name)}${q ? `?${q}` : ""}`);
      } catch (err) {
        const m = errorMessage(err);
        // git's own words for work it would lose.
        if (/modified|untracked|uncommitted|contains/i.test(m) && !checked.force) throw new Error(`${wt.name} has uncommitted changes. Tick "Remove even with uncommitted changes" to remove it anyway. (${m})`);
        throw err;
      }
      scheduleRefresh(box, ["locations", "sessions", "services"]);
      toastManager.add({ title: `Removed ${wt.name}`, description: box, type: "success" });
    },
  });
}

// RunItems are a worktree's services, loaded when the Run submenu opens.
function RunItems({ box, loc, wt }: { box: string; loc: Location; wt: Worktree }) {
  const [list, setList] = useState<WorktreeService[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const client = useStore.getState().client;
    if (!client) return;
    boxApi.worktreeServices(client, box, loc.name, wt.name).then(setList, (e) => {
      setList([]);
      setError(errorMessage(e));
    });
  }, [box, loc.name, wt.name]);
  if (!list) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground text-xs">
        <Spinner className="size-3" /> Loading…
      </div>
    );
  }
  if (!list.length) return <div className="max-w-56 px-2 py-1.5 text-muted-foreground text-xs">{error ?? `${loc.name} defines no services.`}</div>;
  const act = (svc: WorktreeService, action: "start" | "stop" | "restart") => {
    const client = useStore.getState().client;
    if (!client) return;
    boxApi.serviceAction(client, box, loc.name, wt.name, svc.name, action).then(
      () => toastManager.add({ title: `${action === "stop" ? "Stopped" : action === "restart" ? "Restarted" : "Started"} ${svc.name}`, description: wt.main ? loc.name : wt.name, type: "success" }),
      (e) => toastManager.add({ title: `Could not ${action} ${svc.name}`, description: errorMessage(e), type: "error" }),
    );
  };
  const items: Action[] = list.flatMap((svc, i) => {
    const live = svc.state === "running" || svc.state === "activating";
    const url = svc.port ? portUrl(svc.port, { ref: refOf(box, loc, wt), services: useStore.getState().boxes[box]?.services, urlPort: useStore.getState().status?.proxy.url_port }) : undefined;
    return [
      ...(i > 0 ? [sep] : []),
      { type: "label" as const, label: `${svc.name} · ${svc.state}` },
      live ? item(`Stop ${svc.name}`, <SquareIcon />, () => act(svc, "stop")) : item(`Start ${svc.name}`, <PlayIcon />, () => act(svc, "start")),
      ...(live ? [item(`Restart ${svc.name}`, <RotateCwIcon />, () => act(svc, "restart"))] : []),
      ...(live && url
        ? [
            item(`Open ${svc.name}`, <ArrowUpRightIcon />, () => {
              selectWorktree(refOf(box, loc, wt));
              openBrowserAt(url);
            }),
          ]
        : []),
    ];
  });
  return <ActionItems items={items} />;
}

const githubSlug = (loc: Location) => (loc.slug && loc.remote && /github\.com/i.test(loc.remote) ? loc.slug : undefined);

// projectActions is everything a repository row offers.
export function projectActions(box: string, loc: Location): Action[] {
  const st = useStore.getState();
  const main = loc.worktrees?.find((w) => w.main);
  const gh = githubSlug(loc);
  const items: Action[] = [];
  if (main) items.push(item("Open main checkout", <HomeIcon />, () => selectWorktree(refOf(box, loc, main))));
  items.push({ type: "sub", label: "Open in", icon: <CodeXmlIcon />, items: () => <EditorMenuItems box={box} path={main?.path ?? loc.path} /> });
  items.push(
    item("New worktree…", <GitBranchPlusIcon />, () => st.openNewWorktree({ box, location: loc.name }), { shortcut: "⌘N" }),
    item("Project settings", <Settings2Icon />, () => st.setView({ kind: "project", box, location: loc.name })),
    sep,
    item("Copy path", <CopyIcon />, () => copy(loc.path, "path")),
  );
  if (loc.slug) items.push(item("Copy owner/repo", <CopyIcon />, () => copy(loc.slug!, "repository name")));
  if (gh) items.push(item("Open on GitHub", <ExternalLinkIcon />, () => void import("@/lib/open-url").then((m) => m.openUrl(`https://github.com/${gh}`))));
  items.push(
    sep,
    item(
      "Remove project from Berth…",
      <Trash2Icon />,
      () =>
        confirm({
          title: `Remove ${loc.name} from Berth?`,
          description: `Berth stops listing it. Files on ${box} are not touched, and its worktrees stay on disk.`,
          detail: loc.path,
          confirm: "Remove project",
          destructive: true,
          run: async () => {
            const client = useStore.getState().client;
            if (!client) throw new Error("not connected");
            await client.box(box, "DELETE", `locations/${encodeURIComponent(loc.name)}`);
            scheduleRefresh(box, ["locations"]);
            toastManager.add({ title: `Removed ${loc.name}`, description: `from ${box}`, type: "success" });
          },
        }),
      { destructive: true },
    ),
  );
  return items;
}

// boxActions is everything a box offers.
export function boxActions(box: BoxStatus): Action[] {
  const st = useStore.getState();
  const online = box.state === "online";
  const monitor = useRegistry.getState().screens.some((c) => c.plugin === "box-monitor" && c.item.id === "boxes");
  const items: Action[] = [];
  if (online) items.push(item("Add a project…", <FolderOpenIcon />, () => st.openAddProject(box.name)));
  if (monitor) items.push(item("Box monitor", <ActivityIcon />, () => st.setView({ kind: "plugin", screen: "boxes" })));
  if (!online) items.push(item("Reconnect", <RotateCwIcon />, () => void st.refreshAll()));
  if (online)
    items.push(
      item("Upgrade berthd", <ArrowUpCircleIcon />, () => {
        const client = useStore.getState().client;
        if (!client) return;
        const id = toastManager.add({ title: `Upgrading ${box.name}…`, type: "loading" });
        laptopApi.upgrade(client, box.name, () => {}).then(
          () => toastManager.update(id, { title: `Upgraded ${box.name}`, type: "success" }),
          (e) => toastManager.update(id, { title: `Could not upgrade ${box.name}`, description: errorMessage(e), type: "error" }),
        );
      }),
    );
  items.push(
    item("Doctor", <StethoscopeIcon />, () => st.setView({ kind: "settings", section: "boxes" })),
    sep,
    item("Copy address", <CopyIcon />, () => copy(box.address, "address")),
    sep,
    item(
      "Forget box…",
      <UnplugIcon />,
      () =>
        confirm({
          title: `Forget ${box.name}?`,
          description: `This laptop stops trusting it and drops its forwards. Nothing on ${box.name} changes: its sessions keep running, and you can pair again later.`,
          detail: box.address,
          confirm: "Forget box",
          destructive: true,
          run: async () => {
            const client = useStore.getState().client;
            if (!client) throw new Error("not connected");
            await laptopApi.forget(client, box.name);
            await useStore.getState().refreshAll();
            toastManager.add({ title: `Forgot ${box.name}`, type: "success" });
          },
        }),
      { destructive: true },
    ),
  );
  return items;
}
