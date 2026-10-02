import {
  EllipsisIcon,
  FolderPlusIcon,
  GitBranchPlusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
} from "lucide-react";
import { useMemo } from "react";

import { newSection } from "@/components/sidebar/actions";
import { Nav as PlacesNav, useArrangedNav } from "@/components/sidebar/nav";
import { Projects, useSidebarPrefs } from "@/components/sidebar/projects";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { SidebarContext, type SidebarContextProps } from "@/components/ui/sidebar";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { openAddBox } from "@/views/onboarding/add-box-dialog";

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
  const [prefs, update] = useSidebarPrefs();
  const context = useMemo(() => alwaysOpen, []);
  // A new account has no projects to list; onboarding fills the main area.
  const noBoxes = useStore((s) => !!s.status && s.status.boxes.length === 0);
  const collapsed = usePrefs((p) => p.sidebarCollapsed);

  if (collapsed) return <Rail />;

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
          <PlacesNav />
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
              <MenuItem onClick={() => newSection()}>
                <FolderPlusIcon />
                New section…
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
                  <MenuRadioItem value="project">Project</MenuRadioItem>
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

// Rail is the sidebar folded away (⌘\): the window's controls, the places,
// and a way back. It keeps clear of the traffic lights like the full one.
function Rail() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const { pinned, more } = useArrangedNav();
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
        {pinned.map((n) => (
          <span key={n.id}>{item(n.label, n.icon, n.active, () => setView(n.view), n.badge?.count)}</span>
        ))}
        {more.length > 0 && (
          <Menu>
            <MenuTrigger
              render={<button type="button" aria-label="More" title="More" className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground data-popup-open:bg-sidebar-accent" />}
            >
              <EllipsisIcon className="size-4" />
            </MenuTrigger>
            <MenuPopup side="right" align="start" className="min-w-48">
              {more.map((n) => (
                <MenuItem key={n.id} onClick={() => setView(n.view)}>
                  <span className="flex size-4 items-center justify-center [&_svg]:size-4">{n.icon}</span>
                  {n.label}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
        )}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1 pb-2">
        {item("Settings", <SettingsIcon />, view.kind === "settings", () => setView({ kind: "settings" }))}
        {item("Show the sidebar (⌘\\)", <PanelLeftOpenIcon />, false, () => usePrefs.setState({ sidebarCollapsed: false }))}
      </div>
    </aside>
  );
}
