import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GitBranchIcon,
  GripVerticalIcon,
  HistoryIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListIcon,
  PackageIcon,
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
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAgentCounts } from "@/hooks/use-agent-counts";
import { arrange, type NavList, navActions, useNav } from "@/lib/nav";
import { type View, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useRegistry } from "@/plugins/registry";
import { Icon } from "@/plugins/ui";
import { useReviewCount } from "@/views/review/review-store";

// The sidebar's places: the app's own views and any plugin's screens. The
// person arranges them into Pinned, More and Hidden (lib/nav).

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  view: View;
  active: boolean;
  badge?: { count: number; loud?: boolean; title: string };
}

// useNavItems is every place there is, in its default order.
export function useNavItems(): NavItem[] {
  const view = useStore((s) => s.view);
  const plugins = useRegistry((s) => s.sidebarItems);
  const counts = useAgentCounts();
  const toReview = useReviewCount();
  return useMemo(() => {
    const items: NavItem[] = [
      { id: "dashboard", label: "Agent Dashboard", icon: <LayoutDashboardIcon />, view: { kind: "dashboard" }, active: view.kind === "dashboard", badge: counts.waiting ? { count: counts.waiting, loud: true, title: `${counts.waiting} waiting for you` } : undefined },
      { id: "review", label: "Review", icon: <InboxIcon />, view: { kind: "review" }, active: view.kind === "review", badge: toReview ? { count: toReview, title: `${toReview} to review` } : undefined },
      { id: "worktrees", label: "Worktrees", icon: <GitBranchIcon />, view: { kind: "worktrees" }, active: view.kind === "worktrees" },
      { id: "automations", label: "Automations", icon: <WorkflowIcon />, view: { kind: "automations" }, active: view.kind === "automations" },
      { id: "kits", label: "Kits", icon: <PackageIcon />, view: { kind: "kits" }, active: view.kind === "kits" },
      { id: "history", label: "History", icon: <HistoryIcon />, view: { kind: "history" }, active: view.kind === "history" },
      ...plugins.map(({ plugin, item }) => ({
        id: `plugin:${plugin}:${item.id}`,
        label: item.title,
        icon: <Icon name={item.icon ?? "Puzzle"} />,
        view: { kind: "plugin" as const, screen: item.screen },
        active: view.kind === "plugin" && view.screen === item.screen,
      })),
    ];
    return items;
  }, [view, plugins, counts.waiting, toReview]);
}

// useArrangedNav is the items in their lists.
export function useArrangedNav() {
  const items = useNavItems();
  const layout = useNav((s) => s.layout);
  const ids = items.map((i) => i.id);
  const lists = arrange(layout, ids);
  const byId = new Map(items.map((i) => [i.id, i]));
  const pick = (l: NavList) => lists[l].map((id) => byId.get(id)!);
  return { pinned: pick("pinned"), more: pick("more"), hidden: pick("hidden"), ids, moreOpen: layout.moreOpen };
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

function NavRow({ item, list, index, ids }: { item: NavItem; list: NavList; index: number; ids: string[] }) {
  const setView = useStore((s) => s.setView);
  const over = useDrag((s) => s.over);
  const dragging = useDrag((s) => s.id === item.id);
  const before = over?.list === list && over.index === index;
  return (
    <SidebarMenuItem {...dropProps(list, index, ids)} className="relative">
      {before && <span className="pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded-full bg-ring" />}
      <ContextRow items={() => navItemActions(item.id, list, ids)}>
        <SidebarMenuButton
          size="sm"
          isActive={item.active}
          onClick={() => setView(item.view)}
          {...dragProps(item.id)}
          className={cn("h-7 text-[13px] data-[active=true]:font-normal [&>svg]:size-3.5 [&>svg]:text-muted-foreground", dragging && "opacity-40")}
        >
          {item.icon}
          <span>{item.label}</span>
        </SidebarMenuButton>
        {item.badge && (
          <Tip label={item.badge.title} side="right">
            <SidebarMenuBadge className={cn("top-1.25 h-4.5 min-w-4.5 rounded-full px-1 text-[10px] leading-none", item.badge.loud ? "bg-warning/15 text-warning-foreground" : "bg-sidebar-accent text-sidebar-foreground")}>
              {item.badge.count}
            </SidebarMenuBadge>
          </Tip>
        )}
      </ContextRow>
    </SidebarMenuItem>
  );
}

// Nav is the top of the sidebar: pinned places, then More.
export function Nav() {
  const { pinned, more, ids, moreOpen } = useArrangedNav();
  const dragging = useDrag((s) => !!s.id);
  const over = useDrag((s) => s.over);
  const open = moreOpen || dragging;
  return (
    <div>
      <SidebarMenu className="gap-px" {...dropProps("pinned", pinned.length, ids)}>
        {pinned.map((item, i) => (
          <NavRow key={item.id} item={item} list="pinned" index={i} ids={ids} />
        ))}
        {pinned.length === 0 && <li className="px-2 py-1 text-muted-foreground/70 text-xs">Drag places here to pin them.</li>}
      </SidebarMenu>
      {(more.length > 0 || dragging) && (
        <div className="mt-1" {...dropProps("more", more.length, ids)}>
          <button
            type="button"
            onClick={() => void navActions.setMoreOpen(!moreOpen)}
            className="flex h-6.5 w-full items-center gap-1.5 rounded-md px-2 text-muted-foreground text-xs hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <ChevronRightIcon className={cn("size-3 transition-transform", open && "rotate-90")} />
            More
            {!open && more.length > 0 && <span className="text-[11px] tabular-nums">{more.length}</span>}
          </button>
          {open && (
            <SidebarMenu className="gap-px">
              {more.map((item, i) => (
                <NavRow key={item.id} item={item} list="more" index={i} ids={ids} />
              ))}
            </SidebarMenu>
          )}
        </div>
      )}
      {dragging && (
        <div
          {...dropProps("hidden", 0, ids)}
          className={cn(
            "mt-1.5 flex h-8 items-center justify-center gap-1.5 rounded-md border border-dashed text-muted-foreground text-xs",
            over?.list === "hidden" ? "border-ring bg-sidebar-accent text-foreground" : "border-sidebar-border",
          )}
        >
          <EyeOffIcon className="size-3.5" />
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
    ["pinned", "Pinned", pinned, "Always at the top of the sidebar."],
    ["more", "More", more, "In the collapsible More section. New places land here."],
    ["hidden", "Hidden", hidden, "Not in the sidebar; still in ⌘K."],
  ];
  return (
    <Sheet open={open} onOpenChange={(o) => useCustomize.setState({ open: o })}>
      <SheetPopup className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Customize sidebar</SheetTitle>
          <SheetDescription>Drag places between lists, or use the buttons. Right-click a place in the sidebar for the same choices.</SheetDescription>
        </SheetHeader>
        <SheetPanel className="flex flex-col gap-5">
          {lists.map(([list, title, items, hint]) => (
            <section key={list} {...dropProps(list, items.length, ids)}>
              <h3 className="font-medium text-sm">{title}</h3>
              <p className="mb-1.5 text-muted-foreground text-xs">{hint}</p>
              <ul className="flex min-h-9 flex-col gap-px rounded-lg border p-1">
                {items.length === 0 && <li className="px-2 py-1.5 text-muted-foreground/70 text-xs">Nothing here. Drag a place in.</li>}
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
    <li {...dropProps(list, index, ids)} {...dragProps(item.id)} className="relative flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent/60">
      {before && <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded-full bg-ring" />}
      <GripVerticalIcon className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
      <span className="flex size-4 items-center justify-center text-muted-foreground [&_svg]:size-3.5">{item.icon}</span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 [&_svg]:size-3.5"
      >
        {children}
      </button>
    </Tip>
  );
}
