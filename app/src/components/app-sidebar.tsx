import {
  EllipsisIcon,
  FolderPlusIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  InboxIcon,
  LayoutDashboardIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  PackageIcon,
  WorkflowIcon,
} from "lucide-react";
import { useMemo } from "react";

import { Projects, useSidebarPrefs } from "@/components/sidebar/projects";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { SidebarContext, type SidebarContextProps, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAgentCounts } from "@/hooks/use-agent-counts";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useRegistry } from "@/plugins/registry";
import { Icon } from "@/plugins/ui";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { useReviewCount } from "@/views/review/review-store";

// The sidebar is always open on a desktop window; coss ui's menu pieces only
// need to know that.
const alwaysOpen: SidebarContextProps = {
  state: "expanded",
  open: true,
  setOpen: () => {},
  openMobile: false,
  setOpenMobile: () => {},
  isMobile: false,
  toggleSidebar: () => {},
};

// AppSidebar: a short list of places at the top, then the repositories on
// every box, then Settings.
export function AppSidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const pluginItems = useRegistry((s) => s.sidebarItems);
  const counts = useAgentCounts();
  const toReview = useReviewCount();
  const [prefs, update] = useSidebarPrefs();
  const context = useMemo(() => alwaysOpen, []);
  // A new account has no projects to list; onboarding fills the main area.
  const noBoxes = useStore((s) => !!s.status && s.status.boxes.length === 0);
  const collapsed = usePrefs((p) => p.sidebarCollapsed);

  if (collapsed) return <Rail waiting={counts.waiting} toReview={toReview} />;

  return (
    <SidebarContext.Provider value={context}>
      <aside className="flex w-60 shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground">
        {/* Room for the macOS traffic lights; the strip drags the window. */}
        <div data-tauri-drag-region className="h-10 shrink-0" />

        <div className="px-2 pb-1">
          <button
            type="button"
            onClick={() => useStore.getState().setPaletteOpen(true)}
            className="mb-1.5 flex h-7 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-background/50 px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent"
          >
            <SearchIcon className="size-3.5" />
            <span className="flex-1 text-left">Search</span>
            <Kbd className="h-4.5 text-[10px]">⌘K</Kbd>
          </button>
          <SidebarMenu className="gap-px">
            <Nav icon={<LayoutDashboardIcon />} label="Agent Dashboard" active={view.kind === "dashboard"} onClick={() => setView({ kind: "dashboard" })}>
              {counts.waiting > 0 && (
                <SidebarMenuBadge className="top-1.25 h-4.5 min-w-4.5 rounded-full bg-warning/15 px-1 text-[10px] text-warning-foreground leading-none" title={`${counts.waiting} waiting for you`}>
                  {counts.waiting}
                </SidebarMenuBadge>
              )}
            </Nav>
            <Nav icon={<InboxIcon />} label="Review" active={view.kind === "review"} onClick={() => setView({ kind: "review" })}>
              {toReview > 0 && (
                <SidebarMenuBadge className="top-1.25 h-4.5 min-w-4.5 rounded-full bg-sidebar-accent px-1 text-[10px] text-sidebar-foreground leading-none" title={`${toReview} to review`}>
                  {toReview}
                </SidebarMenuBadge>
              )}
            </Nav>
            <Nav icon={<WorkflowIcon />} label="Automations" active={view.kind === "automations"} onClick={() => setView({ kind: "automations" })} />
            <Nav icon={<GitBranchIcon />} label="Worktrees" active={view.kind === "worktrees"} onClick={() => setView({ kind: "worktrees" })} />
            <Nav icon={<PackageIcon />} label="Kits" active={view.kind === "kits"} onClick={() => setView({ kind: "kits" })} />
            {pluginItems.map(({ plugin, item }) => (
              <Nav
                key={`${plugin}:${item.id}`}
                icon={<Icon name={item.icon ?? "Puzzle"} />}
                label={item.title}
                active={view.kind === "plugin" && view.screen === item.screen}
                onClick={() => setView({ kind: "plugin", screen: item.screen })}
              />
            ))}
          </SidebarMenu>
        </div>

        <div className={cn("flex items-center justify-between pt-4 pr-2 pb-1 pl-3", noBoxes && "hidden")}>
          <span className="font-medium text-[11px] text-muted-foreground">Projects</span>
          <Menu>
            <MenuTrigger
              render={<button type="button" aria-label="Projects options" className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground data-popup-open:bg-sidebar-accent" />}
            >
              <EllipsisIcon className="size-3.5" />
            </MenuTrigger>
            <MenuPopup align="end" className="min-w-52">
              <MenuItem onClick={() => useStore.getState().openNewWorktree()}>
                <GitBranchPlusIcon />
                New worktree…
                <span className="ml-auto text-muted-foreground text-xs">⌘N</span>
              </MenuItem>
              <MenuItem onClick={() => useStore.getState().openAddLocation()}>
                <FolderPlusIcon />
                Add a project…
              </MenuItem>
              <MenuItem onClick={openAddBox}>
                <ServerIcon />
                Add a box…
              </MenuItem>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Show</MenuGroupLabel>
                <MenuRadioGroup value={prefs.show} onValueChange={(v) => update({ show: v as typeof prefs.show })}>
                  <MenuRadioItem value="active">Active worktrees</MenuRadioItem>
                  <MenuRadioItem value="all">All worktrees</MenuRadioItem>
                </MenuRadioGroup>
              </MenuGroup>
              <MenuGroup>
                <MenuGroupLabel>Group by</MenuGroupLabel>
                <MenuRadioGroup value={prefs.groupBy} onValueChange={(v) => update({ groupBy: v as typeof prefs.groupBy })}>
                  <MenuRadioItem value="repo">Repository</MenuRadioItem>
                  <MenuRadioItem value="box">Box</MenuRadioItem>
                </MenuRadioGroup>
              </MenuGroup>
            </MenuPopup>
          </Menu>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <Projects prefs={prefs} update={update} />
        </div>

        <div className="flex h-9 shrink-0 items-center gap-1 border-sidebar-border border-t px-2">
          <button
            type="button"
            // Shift-click goes straight to Developer.
            onClick={(e) => setView({ kind: "settings", section: e.shiftKey ? "developer" : undefined })}
            title="Settings (⇧-click: Developer)"
            className={cn("inline-flex h-6.5 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground text-xs hover:bg-sidebar-accent hover:text-foreground", view.kind === "settings" && "text-foreground")}
          >
            <SettingsIcon className="size-3.5" />
            Settings
          </button>
          <button
            type="button"
            aria-label="Hide the sidebar"
            title={"Hide the sidebar (⌘\\)"}
            onClick={() => usePrefs.setState({ sidebarCollapsed: true })}
            className="ml-auto inline-flex size-6.5 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <PanelLeftCloseIcon className="size-3.5" />
          </button>
        </div>
      </aside>
    </SidebarContext.Provider>
  );
}

function Nav({ icon, label, active, onClick, children }: { icon: React.ReactNode; label: string; active?: boolean; onClick(): void; children?: React.ReactNode }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton size="sm" isActive={active} onClick={onClick} className="h-7 text-[13px] data-[active=true]:font-normal [&>svg]:size-3.5 [&>svg]:text-muted-foreground">
        {icon}
        <span>{label}</span>
      </SidebarMenuButton>
      {children}
    </SidebarMenuItem>
  );
}

// Rail is the sidebar folded away (⌘\): the window's controls, the places,
// and a way back. It keeps clear of the traffic lights like the full one.
function Rail({ waiting, toReview }: { waiting: number; toReview: number }) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const item = (label: string, icon: React.ReactNode, active: boolean, onClick: () => void, badge?: number) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground [&_svg]:size-4", active && "bg-sidebar-accent text-foreground")}
    >
      {icon}
      {badge ? <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-warning" /> : null}
    </button>
  );
  return (
    <aside className="flex w-19 shrink-0 flex-col items-center border-sidebar-border border-r bg-sidebar">
      <div data-tauri-drag-region className="h-10 w-full shrink-0" />
      <div className="flex flex-col items-center gap-1">
        {item("Search (⌘K)", <SearchIcon />, false, () => useStore.getState().setPaletteOpen(true))}
        {item("Agent Dashboard", <LayoutDashboardIcon />, view.kind === "dashboard", () => setView({ kind: "dashboard" }), waiting)}
        {item("Review", <InboxIcon />, view.kind === "review", () => setView({ kind: "review" }), toReview)}
        {item("Automations", <WorkflowIcon />, view.kind === "automations", () => setView({ kind: "automations" }))}
        {item("Kits", <PackageIcon />, view.kind === "kits", () => setView({ kind: "kits" }))}
        {item("Worktrees", <GitBranchIcon />, view.kind === "workspace", () => setView({ kind: "workspace" }))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1 pb-2">
        {item("Settings", <SettingsIcon />, view.kind === "settings", () => setView({ kind: "settings" }))}
        {item("Show the sidebar (⌘\\)", <PanelLeftOpenIcon />, false, () => usePrefs.setState({ sidebarCollapsed: false }))}
      </div>
    </aside>
  );
}
