import * as stylex from "@stylexjs/stylex";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  GitBranchIcon,
  GripVerticalIcon,
  HouseIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  WorkflowIcon,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { create } from "zustand";

import { type Action, ContextRow } from "@/components/sidebar/actions";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAgentCounts } from "@/hooks/use-agent-counts";
import { arrange, type NavList, navActions, useNav } from "@/lib/nav";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { goHome, homeBox, useWorkspaces } from "@/lib/workspaces";
import { useRegistry } from "@/plugins/registry";
import { Icon } from "@/plugins/ui";
import { useReviewCount } from "@/views/review/review-store";

const paint = stylex.create({
  s0: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": "8px",
    "right": "8px",
    "top": "-1px",
    "height": "2px",
    "borderRadius": "999px",
    "backgroundColor": "var(--ring)",
  },
  s1: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s2: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s3: {
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s4: {
    "color": "var(--warning-foreground)",
  },
  s5: {
    "color": "var(--muted-foreground)",
  },
  s6: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": "50%",
    "transform": "translateY(-50%)",
    "right": "8px",
    "maxWidth": "96px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "marginTop": "6px",
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "borderColor": "var(--ring)",
    "backgroundColor": "var(--sidebar-accent)",
    "color": "var(--foreground)",
  },
  s10: {
    "borderColor": "var(--sidebar-border)",
  },
  s11: {
    "width": "14px",
    "height": "14px",
  },
  s12: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s13: {
    "marginBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "display": "flex",
    "minHeight": "36px",
    "flexDirection": "column",
    "gap": "1px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "padding": "4px",
  },
  s15: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "position": "relative",
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s17: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": "4px",
    "right": "4px",
    "top": "-1px",
    "height": "2px",
    "borderRadius": "999px",
    "backgroundColor": "var(--ring)",
  },
  s18: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "cursor": "grab",
    "color": "var(--muted-foreground)",
  },
  s19: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s20: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s21: {
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
    "opacity": {
      ":disabled": 0.3,
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The app's places: Home, its own views and any plugin's screens. The person
// arranges them into Pinned, More and Hidden (lib/nav). This is the one model
// of the way around: the sidebar, its folded rail and zen's switcher all draw
// useArrangedNav, so they list the same places in the same order.

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  // go opens the place. Every way in (a row, the rail, zen, ⌘K) calls it.
  go(): void;
  badge?: { count: number; loud?: boolean; title: string };
}

// useNavItems is every place there is, in its default order.
//
// Home is where you start work and see your agents. With Labs that is the
// harbour home (a composer and your agents), and the Agent Dashboard is a
// place of its own under More. Without Labs there is no harbour, so the
// first place is the Agent Dashboard itself, under its own name.
export function useNavItems(): NavItem[] {
  const view = useStore((s) => s.view);
  // A box's home terminals show over Home.
  const noWorktree = useWorkspaces((s) => !s.current || !!homeBox(s.current));
  const labs = usePrefs((p) => p.labs);
  const plugins = useRegistry((s) => s.sidebarItems);
  const counts = useAgentCounts();
  const toReview = useReviewCount();
  return useMemo(() => {
    // A fresh object, so clicking the page you're on still says so
    // (Automations leaves its flow editor).
    const open = (v: typeof view) => () => useStore.getState().setView({ ...v });
    const waiting = counts.waiting ? { count: counts.waiting, loud: true, title: `${counts.waiting} waiting for you` } : undefined;
    const dashboard = { label: "Agent Dashboard", icon: <LayoutDashboardIcon />, go: open({ kind: "dashboard" }), active: view.kind === "dashboard" };
    const items: NavItem[] = [
      labs
        ? { id: "home", label: "Home", icon: <HouseIcon />, go: goHome, active: view.kind === "workspace" && noWorktree, badge: waiting }
        : { id: "home", ...dashboard, badge: waiting },
      { id: "review", label: "Review", icon: <InboxIcon />, go: open({ kind: "review" }), active: view.kind === "review", badge: toReview ? { count: toReview, title: `${toReview} to review` } : undefined },
      { id: "worktrees", label: "Worktrees", icon: <GitBranchIcon />, go: open({ kind: "worktrees" }), active: view.kind === "worktrees" },
      { id: "automations", label: "Automations", icon: <WorkflowIcon />, go: open({ kind: "automations" }), active: view.kind === "automations" },
      ...(labs ? [{ id: "dashboard", ...dashboard }] : []),
      ...plugins.map(({ plugin, item }) => ({
        id: `plugin:${plugin}:${item.id}`,
        label: item.title,
        icon: <Icon name={item.icon ?? "Puzzle"} />,
        go: open({ kind: "plugin", screen: item.screen }),
        active: view.kind === "plugin" && view.screen === item.screen,
      })),
    ];
    return items;
  }, [view, noWorktree, labs, plugins, counts.waiting, toReview]);
}

// useArrangedNav is the items in their lists.
export function useArrangedNav() {
  const items = useNavItems();
  const layout = useNav((s) => s.layout);
  const ids = items.map((i) => i.id);
  const lists = arrange(layout, ids);
  const byId = new Map(items.map((i) => [i.id, i]));
  const pick = (l: NavList) => lists[l].map((id) => byId.get(id)!);
  return { pinned: pick("pinned"), more: pick("more"), hidden: pick("hidden"), ids };
}

// The item being dragged, shared by every list it may land in.
const useDrag = create<{ id?: string; over?: { list: NavList; index: number } }>()(() => ({}));

function navItemActions(id: string, list: NavList, ids: string[]): Action[] {
  const items: Action[] = [];
  if (list !== "pinned") items.push({ type: "item", label: "Pin", icon: <PinIcon />, run: () => navActions.place(id, "pinned", undefined, ids) });
  if (list !== "more") items.push({ type: "item", label: list === "pinned" ? "Move to More" : "Show in More", icon: list === "pinned" ? <PinOffIcon /> : <EyeIcon />, run: () => navActions.place(id, "more", undefined, ids) });
  if (list !== "hidden") items.push({ type: "item", label: "Hide", icon: <EyeOffIcon />, hint: "still in ⌘K", run: () => navActions.place(id, "hidden", undefined, ids) });
  items.push(
    { type: "sep" },
    { type: "item", label: "Move up", icon: <ArrowUpIcon />, run: () => navActions.move(id, -1, ids) },
    { type: "item", label: "Move down", icon: <ArrowDownIcon />, run: () => navActions.move(id, 1, ids) },
    { type: "sep" },
    { type: "item", label: "Customize sidebar…", icon: <SlidersHorizontalIcon />, run: () => openCustomize() },
  );
  return items;
}

// dropProps makes an element a drop target: dropping there puts the dragged
// item into list at index.
function dropProps(list: NavList, index: number, ids: string[]) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!useDrag.getState().id) return;
      e.preventDefault();
      e.stopPropagation();
      const o = useDrag.getState().over;
      if (o?.list !== list || o.index !== index) useDrag.setState({ over: { list, index } });
    },
    onDrop: (e: React.DragEvent) => {
      const id = useDrag.getState().id;
      e.preventDefault();
      e.stopPropagation();
      useDrag.setState({ id: undefined, over: undefined });
      if (id) void navActions.place(id, list, index, ids);
    },
  };
}

function dragProps(id: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("application/x-berth-nav", id);
      e.dataTransfer.effectAllowed = "move";
      useDrag.setState({ id });
    },
    onDragEnd: () => useDrag.setState({ id: undefined, over: undefined }),
  };
}

function RowBadge({ badge }: { badge: NonNullable<NavItem["badge"]> }) {
  return (
    <Tip label={badge.title} side="right">
      <SidebarMenuBadge pill={badge.loud ? "loud" : "quiet"}>
        {badge.count}
      </SidebarMenuBadge>
    </Tip>
  );
}

function NavRow({ item, list, index, ids }: { item: NavItem; list: NavList; index: number; ids: string[] }) {
  const over = useDrag((s) => s.over);
  const dragging = useDrag((s) => s.id === item.id);
  const before = over?.list === list && over.index === index;
  return (
    <SidebarMenuItem {...dropProps(list, index, ids)}>
      {before && <span className={sx(paint.s0)} />}
      <ContextRow items={() => navItemActions(item.id, list, ids)}>
        <SidebarMenuButton size="sm" density="row" dim={dragging} data-testid={`nav-${item.id}`} isActive={item.active} aria-current={item.active ? "page" : undefined} onClick={item.go} {...dragProps(item.id)}>
          {item.icon}
          <span>{item.label}</span>
        </SidebarMenuButton>
        {item.badge && <RowBadge badge={item.badge} />}
      </ContextRow>
    </SidebarMenuItem>
  );
}

// MoreItems is More's places as menu items, then a way to rearrange them.
// The sidebar, the rail and zen's switcher share it.
export function MoreItems({ more }: { more: NavItem[] }) {
  return (
    <>
      {more.map((n) => (
        <MenuItem key={n.id} onClick={n.go} aria-current={n.active ? "page" : undefined} current={n.active}>
          <span className={sx(paint.s1)}>{n.icon}</span>
          <span className={sx(paint.s2)}>{n.label}</span>
          {n.badge && <span className={[sx(paint.s3), n.badge.loud ? sx(paint.s4) : sx(paint.s5)].filter(Boolean).join(" ")}>{n.badge.count}</span>}
        </MenuItem>
      ))}
      {more.length > 0 && <MenuSeparator />}
      <MenuItem onClick={() => openCustomize()}>
        <SlidersHorizontalIcon />
        Customize sidebar…
      </MenuItem>
    </>
  );
}

// Nav is the top of the sidebar: the pinned places, then More, a menu of
// the rest. More stays one row however many plugins there are; while you
// are on one of its places it is highlighted and names it.
export function Nav() {
  const { pinned, more, ids } = useArrangedNav();
  const dragging = useDrag((s) => !!s.id);
  const over = useDrag((s) => s.over);
  const here = more.find((n) => n.active);
  const loud = more.find((n) => n.badge?.loud);
  return (
    <div>
      <SidebarMenu gap="tight" {...dropProps("pinned", pinned.length, ids)}>
        {pinned.map((item, i) => (
          <NavRow key={item.id} item={item} list="pinned" index={i} ids={ids} />
        ))}
        {pinned.length === 0 && <li className={sx(paint.s6)}>Drag places here to pin them.</li>}
        <SidebarMenuItem {...dropProps("more", more.length, ids)}>
          <Menu>
            <MenuTrigger
              render={
                <SidebarMenuButton size="sm" density="row" isActive={!!here} hot={dragging && over?.list === "more"} />
              }
            >
              <EllipsisIcon />
              <span>{dragging ? "Drop in More" : "More"}</span>
            </MenuTrigger>
            <MenuPopup side="right" align="start" width={menuWidths.w72}>
              <MoreItems more={more} />
            </MenuPopup>
          </Menu>
          {here ? (
            <span className={sx(paint.s7)}>{here.label}</span>
          ) : loud?.badge ? (
            <RowBadge badge={loud.badge} />
          ) : null}
        </SidebarMenuItem>
      </SidebarMenu>
      {dragging && (
        <div
          {...dropProps("hidden", 0, ids)}
          className={[sx(paint.s8), over?.list === "hidden" ? sx(paint.s9) : sx(paint.s10)].filter(Boolean).join(" ")}
        >
          <EyeOffIcon className={sx(paint.s11)} />
          Drop to hide (still in ⌘K)
        </div>
      )}
    </div>
  );
}

// The Customize sheet: every place, in its three lists, with drag handles
// and buttons, and a way back to the defaults.
const useCustomize = create<{ open: boolean }>()(() => ({ open: false }));
export const openCustomize = () => useCustomize.setState({ open: true });

export function CustomizeSidebarSheet() {
  const open = useCustomize((s) => s.open);
  const { pinned, more, hidden, ids } = useArrangedNav();
  const lists: [NavList, string, NavItem[], string][] = [
    ["pinned", "Pinned", pinned, "At the top of the sidebar and zen's switcher."],
    ["more", "More", more, "In the More menu. New places, such as a plugin's, land here."],
    ["hidden", "Hidden", hidden, "Not in the sidebar; still in ⌘K."],
  ];
  return (
    <Sheet open={open} onOpenChange={(o) => useCustomize.setState({ open: o })}>
      <SheetPopup width="sm">
        <SheetHeader>
          <SheetTitle>Customize sidebar</SheetTitle>
          <SheetDescription>Drag places between lists, or use the buttons. Right-click a place in the sidebar for the same choices.</SheetDescription>
        </SheetHeader>
        <SheetPanel stack={5}>
          {lists.map(([list, title, items, hint]) => (
            <section key={list} {...dropProps(list, items.length, ids)}>
              <h3 className={sx(paint.s12)}>{title}</h3>
              <p className={sx(paint.s13)}>{hint}</p>
              <ul className={sx(paint.s14)}>
                {items.length === 0 && <li className={sx(paint.s15)}>Nothing here. Drag a place in.</li>}
                {items.map((item, i) => (
                  <CustomizeRow key={item.id} item={item} list={list} index={i} count={items.length} ids={ids} />
                ))}
              </ul>
            </section>
          ))}
        </SheetPanel>
        <SheetFooter>
          <Button variant="ghost" onClick={() => void navActions.reset()}>
            <RotateCcwIcon />
            Reset to default
          </Button>
          <Button onClick={() => useCustomize.setState({ open: false })}>Done</Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}

function CustomizeRow({ item, list, index, count, ids }: { item: NavItem; list: NavList; index: number; count: number; ids: string[] }) {
  const over = useDrag((s) => s.over);
  const before = over?.list === list && over.index === index;
  const other: [NavList, string, ReactNode][] = (
    [
      ["pinned", "Pin", <PinIcon key="p" />],
      ["more", "Move to More", <ListIcon key="m" />],
      ["hidden", "Hide", <EyeOffIcon key="h" />],
    ] as [NavList, string, ReactNode][]
  ).filter(([l]) => l !== list);
  return (
    <li {...dropProps(list, index, ids)} {...dragProps(item.id)} className={sx(paint.s16)}>
      {before && <span className={sx(paint.s17)} />}
      <GripVerticalIcon className={sx(paint.s18)} />
      <span className={sx(paint.s19)}>{item.icon}</span>
      <span className={sx(paint.s20)}>{item.label}</span>
      <IconButton label="Move up" disabled={index === 0} onClick={() => navActions.move(item.id, -1, ids)}>
        <ArrowUpIcon />
      </IconButton>
      <IconButton label="Move down" disabled={index === count - 1} onClick={() => navActions.move(item.id, 1, ids)}>
        <ArrowDownIcon />
      </IconButton>
      {other.map(([l, label, icon]) => (
        <IconButton key={l} label={label} onClick={() => navActions.place(item.id, l, undefined, ids)}>
          {icon}
        </IconButton>
      ))}
    </li>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={sx(paint.s21)}
      >
        {children}
      </button>
    </Tip>
  );
}
