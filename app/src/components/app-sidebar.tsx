import {
  EllipsisIcon,
  MonitorIcon,
  FolderPlusIcon,
  GitBranchPlusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";

import { NotificationBell } from "@/components/notifications/notification-center";
import { newSection } from "@/components/sidebar/actions";
import { MoreItems, Nav as PlacesNav, useArrangedNav } from "@/components/sidebar/nav";
import { Projects, useSidebarPrefs } from "@/components/sidebar/projects";
import { RailAgents } from "@/components/sidebar/rail";
import { SidebarResizeHandle } from "@/components/sidebar/resize-handle";
import { RowLayer } from "@/components/sidebar/row-layer";
import { Tip } from "@/components/tip";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { SidebarContext, type SidebarContextProps } from "@/components/ui/sidebar";
import { usePrefs } from "@/lib/prefs";
import { useLocalComputer } from "@/lib/local-computer";
import { useStore } from "@/lib/store";
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN } from "@/lib/sidebar-width";
import { WhatsNewNudge } from "@/components/whats-new/whats-new-dialog";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { platformKeys } from "@/lib/platform";
import { color, radius } from "@/styles/tokens.stylex";

const styles = stylex.create({
  aside: {
    containerType: "inline-size",
    containerName: "side",
    position: "relative",
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: color.sidebarBorder,
    backgroundColor: color.sidebar,
    color: color.sidebarForeground,
  },
  drag: {
    display: "flex",
    height: 40,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingLeft: 8,
    paddingRight: 8,
  },
  searchWrap: { paddingLeft: 8, paddingRight: 8, paddingBottom: 4 },
  search: {
    display: "flex",
    height: 28,
    width: "100%",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.sidebarBorder,
    backgroundColor: { default: "color-mix(in oklab, var(--background) 50%, transparent)", ":hover": color.sidebarAccent },
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 13,
    color: color.mutedForeground,
  },
  icon35: { width: 14, height: 14, flexShrink: 0 },
  icon4: { width: 16, height: 16, flexShrink: 0 },
  grow: { flexGrow: 1, flexShrink: 1, flexBasis: "0%", textAlign: "left" },
  kbd: { height: 18, fontSize: 10 },
  projectsHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingRight: 8,
    paddingBottom: 4,
    paddingLeft: 12,
  },
  gone: { display: "none" },
  label: { fontWeight: 500, fontSize: 11, color: color.mutedForeground },
  iconBtn: {
    display: "inline-flex",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    color: { default: color.mutedForeground, ":hover": color.foreground },
    backgroundColor: { default: "transparent", ":hover": color.sidebarAccent, "[data-popup-open]": color.sidebarAccent },
    ":not(#\\#) svg": { width: 14, height: 14 },
  },
  hint: { marginLeft: "auto", color: color.mutedForeground, fontSize: 12 },
  foot: {
    display: "flex",
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    gap: 4,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.sidebarBorder,
    paddingLeft: 8,
    paddingRight: 8,
  },
  settings: {
    display: "inline-flex",
    height: 26,
    alignItems: "center",
    gap: 6,
    borderRadius: radius.md,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 12,
    color: { default: color.mutedForeground, ":hover": color.foreground },
    backgroundColor: { default: "transparent", ":hover": color.sidebarAccent },
  },
  settingsOn: { color: color.foreground },
  collapse: {
    display: "inline-flex",
    width: 26,
    height: 26,
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    color: { default: color.mutedForeground, ":hover": color.foreground },
    backgroundColor: { default: "transparent", ":hover": color.sidebarAccent },
  },
  local: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    textAlign: "left",
    fontSize: 12,
    color: { default: color.mutedForeground, ":hover": color.foreground },
    backgroundColor: { default: "transparent", ":hover": color.sidebarAccent },
  },
  localWide: { width: "100%", marginBottom: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 },
  localCompact: { width: 32, height: 32, justifyContent: "center" },
  localOn: { backgroundColor: color.sidebarAccent, color: color.foreground },
  localText: { minWidth: 0 },
  localName: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  localSub: { display: "block", fontSize: 10, color: color.mutedForeground },
  rail: {
    position: "relative",
    display: "flex",
    width: 76,
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: color.sidebarBorder,
    backgroundColor: color.sidebar,
  },
  railDrag: { height: 40, width: "100%", flexShrink: 0 },
  railCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  railBody: { marginTop: 8, minHeight: 0, width: "100%", flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  railFoot: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 4, paddingBottom: 8 },
  railBtn: {
    position: "relative",
    display: "inline-flex",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    color: { default: color.mutedForeground, ":hover": color.foreground },
    backgroundColor: { default: "transparent", ":hover": color.sidebarAccent, "[data-popup-open]": color.sidebarAccent },
    ":not(#\\#) svg": { width: 16, height: 16 },
  },
  railOn: { backgroundColor: color.sidebarAccent, color: color.foreground },
  badge: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: radius.full },
  badgeLoud: { backgroundColor: color.warning },
  badgeQuiet: { backgroundColor: "color-mix(in oklab, var(--muted-foreground) 70%, transparent)" },
});

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

  const frame = stylex.props(styles.aside);
  return (
    <SidebarContext.Provider value={context}>
      {/* Its width is --sidebar-w (prefs), or --sidebar-live as a drag
          runs, held to the narrowest and widest (lib/sidebar-width) even as
          the window shrinks; a container, so rows show more of a worktree
          when there is room. */}
      <aside
        aria-label="Sidebar"
        data-testid="sidebar"
        {...frame}
        style={{ ...frame.style, width: `clamp(${SIDEBAR_MIN}px, var(--sidebar-live, var(--sidebar-w, ${SIDEBAR_DEFAULT}px)), max(${SIDEBAR_DEFAULT}px, min(${SIDEBAR_MAX}px, 40vw)))` }}
      >
        <SidebarResizeHandle />
        {/* Room for the macOS traffic lights; the strip drags the window. */}
        <div data-tauri-drag-region {...stylex.props(styles.drag)}>
          <NotificationBell />
        </div>

        <div {...stylex.props(styles.searchWrap)}>
          <button
            type="button"
            onClick={() => useStore.getState().setPaletteOpen(true)}
            {...stylex.props(styles.search)}
          >
            <SearchIcon {...stylex.props(styles.icon35)} />
            <span {...stylex.props(styles.grow)}>Search</span>
            <span {...stylex.props(styles.kbd)}><Kbd>⌘K</Kbd></span>
          </button>
          <PlacesNav />
        </div>

        <div {...stylex.props(styles.projectsHead, noBoxes && styles.gone)}>
          <span {...stylex.props(styles.label)}>Projects</span>
          <Menu>
            <MenuTrigger
              render={<button type="button" aria-label="Projects options" {...stylex.props(styles.iconBtn)} />}
            >
              <EllipsisIcon />
            </MenuTrigger>
            <MenuPopup align="end" width={menuWidths.w52}>
              <MenuItem onClick={() => useStore.getState().openNewWorktree()}>
                <GitBranchPlusIcon />
                New task…
                <span {...stylex.props(styles.hint)}>{platformKeys("⌘N")}</span>
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

        {/* One context menu and one tooltip for every row in it. */}
        <RowLayer layout="projects">
          <LocalComputerLink />
          <Projects prefs={prefs} update={update} />
        </RowLayer>

        <WhatsNewNudge />
        <div {...stylex.props(styles.foot)}>
          <Tip label="⇧-click for Developer settings" side="top" align="start">
            <button
              type="button"
              data-testid="nav-settings"
              aria-current={view.kind === "settings" ? "page" : undefined}
              // Shift-click goes straight to Developer.
              onClick={(e) => setView({ kind: "settings", section: e.shiftKey ? "developer" : undefined })}
              {...stylex.props(styles.settings, view.kind === "settings" && styles.settingsOn)}
            >
              <SettingsIcon {...stylex.props(styles.icon35)} />
              Settings
            </button>
          </Tip>
          <Tip label={"Hide the sidebar (⌘\\)"} side="top">
            <button
              type="button"
              aria-label="Hide the sidebar"
              onClick={() => usePrefs.setState({ sidebarCollapsed: true })}
              {...stylex.props(styles.collapse)}
            >
              <PanelLeftCloseIcon {...stylex.props(styles.icon35)} />
            </button>
          </Tip>
        </div>
      </aside>
    </SidebarContext.Provider>
  );
}

function LocalComputerLink({ compact = false }: { compact?: boolean }) {
  const local = useLocalComputer();
  const active = useStore((s) => s.view.kind === "local");
  if (!local?.supported) return null;
  return (
    <Tip label={`This computer: ${local.name}`} side="right">
      <button type="button" data-testid="nav-local" aria-label={`This computer: ${local.name}`} aria-current={active ? "page" : undefined}
        onClick={() => useStore.getState().setView({ kind: "local" })}
        {...stylex.props(styles.local, compact ? styles.localCompact : styles.localWide, active && styles.localOn)}>
        <MonitorIcon {...stylex.props(styles.icon35)} />
        {!compact && <span {...stylex.props(styles.localText)}><span {...stylex.props(styles.localName)}>{local.name}</span><span {...stylex.props(styles.localSub)}>This computer</span></span>}
      </button>
    </Tip>
  );
}

// Rail is the sidebar folded away (⌘\): the window's controls, the places
// in the sidebar's own order, the agents by state (sidebar/rail.tsx), and a
// way back. It keeps clear of the traffic lights like the full one, which is
// why it is 76px.
function Rail() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const { pinned, more } = useArrangedNav();
  const item = (label: string, icon: ReactNode, active: boolean, onClick: () => void, badge?: { count: number; loud?: boolean }) => (
    <Tip label={label} side="right">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        {...stylex.props(styles.railBtn, active && styles.railOn)}
      >
        {icon}
        {/* Amber only when something needs you, as in the sidebar. */}
        {badge?.count ? <span {...stylex.props(styles.badge, badge.loud ? styles.badgeLoud : styles.badgeQuiet)} /> : null}
      </button>
    </Tip>
  );
  return (
    <aside aria-label="Sidebar" data-testid="sidebar-rail" {...stylex.props(styles.rail)}>
      <SidebarResizeHandle folded />
      <div data-tauri-drag-region {...stylex.props(styles.railDrag)} />
      <div {...stylex.props(styles.railCol)}>
        {item("Search (⌘K)", <SearchIcon />, false, () => useStore.getState().setPaletteOpen(true))}
        <NotificationBell size="rail" />
        <LocalComputerLink compact />
        {pinned.map((n) => (
          <span key={n.id}>{item(n.label, n.icon, n.active, n.go, n.badge)}</span>
        ))}
        <Menu>
          <Tip label="More" side="right">
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label="More"
                  {...stylex.props(styles.railBtn, more.some((n) => n.active) && styles.railOn)}
                />
              }
            >
              <EllipsisIcon />
            </MenuTrigger>
          </Tip>
          <MenuPopup side="right" align="start" width={menuWidths.w72}>
            <MoreItems more={more} />
          </MenuPopup>
        </Menu>
      </div>
      <div {...stylex.props(styles.railBody)}>
        <RailAgents />
      </div>
      <div {...stylex.props(styles.railFoot)}>
        {item("Settings", <SettingsIcon />, view.kind === "settings", () => setView({ kind: "settings" }))}
        {item("Show the sidebar (⌘\\)", <PanelLeftOpenIcon />, false, () => usePrefs.setState({ sidebarCollapsed: false }))}
      </div>
    </aside>
  );
}
