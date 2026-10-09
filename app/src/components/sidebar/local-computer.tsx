import {
  ChevronRightIcon,
  Loader2Icon,
  MessageSquareIcon,
  MonitorIcon,
  PlusIcon,
  SearchIcon,
  TerminalIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { errorMessage } from "@/lib/format";
import { localAgentName, localApi, useLocalComputer, type LocalConversation, type LocalSession } from "@/lib/local-computer";
import { useLocalComputerRefresh } from "@/lib/local-computer-refresh";
import { buildLocalThreadRows, groupLocalThreadRows, type LocalThreadRow } from "@/lib/local-thread-rows";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SidebarPrefs } from "@/components/sidebar/projects";

const LOCAL_KEY = "local";

function openLocalComposer() {
  useStore.getState().setView({ kind: "local" });
}

function openLocalRow(row: LocalThreadRow) {
  if (row.kind === "session" && row.session) {
    useStore.getState().setView({ kind: "local", session: row.session });
    return;
  }
  if (row.kind === "history" && row.conversation) {
    useStore.getState().setView({ kind: "local", history: row.conversation });
  }
}

function rowActive(row: LocalThreadRow, view: ReturnType<typeof useStore.getState>["view"]): boolean {
  if (view.kind !== "local") return false;
  if (row.kind === "session" && row.session && view.session) return view.session.id === row.session.id;
  if (row.kind === "history" && row.conversation && view.history) return view.history.id === row.conversation.id;
  return false;
}

// LocalComputerTree: This computer expands to folder groups, then chats
// (live sessions and history), matching RepoGroup's chevron prefs.
export function LocalComputerTree({ prefs, update }: { prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  const local = useLocalComputer();
  const client = useStore((s) => s.client);
  const view = useStore((s) => s.view);
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !local?.supported) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const status = await localApi.status(client, controller.signal);
      if (controller.signal.aborted) return;
      setSessions(status.sessions ?? []);
      const history = status.supported ? await localApi.conversations(client, controller.signal) : [];
      if (controller.signal.aborted) return;
      setConversations(history ?? []);
      setError("");
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    }
  }, [client, local?.supported]);

  const refreshTick = useLocalComputerRefresh((s) => s.n);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    return () => {
      request.current?.abort();
      clearInterval(timer);
    };
  }, [refresh, refreshTick]);

  const rows = useMemo(() => buildLocalThreadRows(conversations, sessions), [conversations, sessions]);
  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () => (query ? rows.filter((r) => r.title.toLowerCase().includes(query)) : rows),
    [rows, query],
  );
  const groups = useMemo(() => groupLocalThreadRows(filtered), [filtered]);
  const collapsed = prefs.collapsed[LOCAL_KEY] ?? false;
  const active = view.kind === "local";
  const composerActive = active && view.kind === "local" && !view.session && !view.history;
  const toggle = () => update({ collapsed: { ...prefs.collapsed, [LOCAL_KEY]: !collapsed } });

  if (!local?.supported) return null;

  return (
    <SidebarMenu className="mb-2 gap-0">
      <SidebarMenuItem>
        <Tip side="right" delay={700} wrapClassName="flex w-full min-w-0" label={`This computer: ${local.name}`}>
          <SidebarMenuButton
            size="sm"
            data-testid="nav-local"
            aria-label={`This computer: ${local.name}`}
            aria-current={composerActive ? "page" : undefined}
            aria-expanded={!collapsed}
            isActive={composerActive}
            onClick={() => {
              openLocalComposer();
              if (collapsed) toggle();
            }}
            onKeyDown={(e) => {
              if ((e.key === "ArrowRight" && collapsed) || (e.key === "ArrowLeft" && !collapsed)) {
                e.preventDefault();
                toggle();
              }
            }}
            className="h-[calc(var(--side-row)+0.125rem)] gap-1.5 font-medium text-[13px] text-foreground"
          >
            <Tip label={collapsed ? "Show chats" : "Hide chats"} side="right">
              <span
                aria-hidden
                data-fold=""
                className="-ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
              >
                <ChevronRightIcon className={cn("size-3 transition-transform", !collapsed && "rotate-90")} />
              </span>
            </Tip>
            <MonitorIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block truncate">{local.name}</span>
              <span className="block text-[10px] font-normal text-muted-foreground">This computer</span>
            </span>
          </SidebarMenuButton>
        </Tip>

        {!collapsed && (
          <SidebarMenuSub className="mx-0 ml-[17px] gap-px py-0.5 pr-0 pl-1.5">
            <SidebarMenuSubItem>
              <button
                type="button"
                data-testid="local-new-agent"
                onClick={openLocalComposer}
                className="flex h-side-row w-full items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              >
                <PlusIcon className="size-3.5 shrink-0" />
                New agent
              </button>
            </SidebarMenuSubItem>
            {rows.length > 0 && (
              <SidebarMenuSubItem>
                <label className="relative flex h-7 items-center px-1">
                  <SearchIcon className="pointer-events-none absolute left-2.5 size-3 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search local conversations"
                    placeholder="Search chats"
                    className="h-7 w-full rounded-md border border-sidebar-border bg-background/50 pr-2 pl-7 text-[12px] outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
              </SidebarMenuSubItem>
            )}
            {error && (
              <SidebarMenuSubItem>
                <p role="alert" className="px-2 py-1 text-[11px] text-destructive">
                  {error}
                </p>
              </SidebarMenuSubItem>
            )}
            {query && groups.length === 0 && (
              <SidebarMenuSubItem>
                <p className="px-2 py-2 text-[11px] text-muted-foreground">No matching chats.</p>
              </SidebarMenuSubItem>
            )}
            {!query && !error && groups.length === 0 && (
              <SidebarMenuSubItem>
                <p className="px-2 py-2 text-[11px] text-muted-foreground">No local chats yet.</p>
              </SidebarMenuSubItem>
            )}
            {groups.map((group) => {
              const folderKey = `local-folder:${group.cwd}`;
              const folderCollapsed = prefs.collapsed[folderKey] ?? false;
              const folderToggle = () => update({ collapsed: { ...prefs.collapsed, [folderKey]: !folderCollapsed } });
              return (
                <SidebarMenuSubItem key={group.cwd || "unknown"}>
                  <Tip label={group.hint} side="right" delay={700}>
                    <button
                      type="button"
                      data-testid="local-folder"
                      data-folder={group.cwd}
                      aria-expanded={!folderCollapsed}
                      onClick={folderToggle}
                      className="flex h-6 w-full items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRightIcon className={cn("size-3 shrink-0 transition-transform", !folderCollapsed && "rotate-90")} />
                      <span className="min-w-0 truncate">{group.label}</span>
                    </button>
                  </Tip>
                  {!folderCollapsed && (
                    <SidebarMenuSub className="mx-0 ml-2 gap-px border-l border-sidebar-border py-0.5 pr-0 pl-1.5">
                      {group.rows.map((row) => (
                        <LocalChatRow key={row.id} row={row} active={rowActive(row, view)} />
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function LocalChatRow({ row, active }: { row: LocalThreadRow; active: boolean }) {
  const agentId = row.session?.agent ?? row.conversation?.source ?? "";
  const agent = agentId ? localAgentName(agentId) : "";
  const stateLabel =
    row.state === "waiting" ? "waiting" : row.state === "running" ? "running" : row.state === "idle" ? "idle" : row.state === "exited" ? "stopped" : "";
  // Untitled live sessions keep the old middle-column name ("Codex waiting");
  // titled history keeps its title so e2e can open "Second history" etc.
  const primary = row.title !== "Untitled" ? row.title : agent || row.title;
  const label = [primary, stateLabel].filter(Boolean).join(" ");
  const statusWord = row.state === "waiting" ? "Waiting" : row.state === "exited" ? "Stopped" : "";
  const running = row.state === "running" || row.state === "waiting";
  const icon =
    row.kind === "session" && row.session?.mode !== "chat" ? (
      <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
    ) : (
      <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
    );
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={<button type="button" data-testid="local-chat-row" data-chat={row.id} aria-label={label} />}
        isActive={active}
        onClick={() => openLocalRow(row)}
        className="h-side-row w-full text-[13px]"
      >
        {icon}
        {running && <Loader2Icon aria-hidden className="size-3 shrink-0 animate-spin text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate">{row.title}</span>
        {statusWord && !running && <span className="shrink-0 text-[10px] text-muted-foreground">{statusWord}</span>}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

// Compact rail control: opens This computer without the tree.
export function LocalComputerRailLink() {
  const local = useLocalComputer();
  const active = useStore((s) => s.view.kind === "local");
  if (!local?.supported) return null;
  return (
    <Tip label={`This computer: ${local.name}`} side="right">
      <button
        type="button"
        data-testid="nav-local"
        aria-label={`This computer: ${local.name}`}
        aria-current={active ? "page" : undefined}
        onClick={() => openLocalComposer()}
        className={cn("inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground", active && "bg-sidebar-accent text-foreground")}
      >
        <MonitorIcon className="size-4" />
      </button>
    </Tip>
  );
}
