import * as stylex from "@stylexjs/stylex";
import { ChevronRightIcon, MessageSquareIcon, MonitorIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Tip } from "@/components/tip";
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { localAgentName, localApi, publishLocalThreads, useLocalComputer, useLocalThreadList, type LocalConversation, type LocalSession } from "@/lib/local-computer";
import { useLocalBox } from "@/lib/local-box";
import { useStore } from "@/lib/store";
import { thisComputerName } from "@/lib/this-computer";
import { color, radius } from "@/styles/tokens.stylex";

const styles = stylex.create({
  local: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    textAlign: "left",
    color: { default: color.mutedForeground, ":hover": color.foreground },
    backgroundColor: { default: "transparent", ":hover": color.sidebarAccent },
  },
  wide: { width: "100%", marginBottom: 4, paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 },
  compact: { width: 32, height: 32, justifyContent: "center" },
  on: { backgroundColor: color.sidebarAccent, color: color.foreground },
  icon: { width: 14, height: 14, flexShrink: 0 },
  fold: { width: 12, height: 12, flexShrink: 0, color: color.mutedForeground },
  folded: { transform: "rotate(90deg)" },
  text: { minWidth: 0 },
  name: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: color.foreground },
  sub: { display: "block", fontSize: 10, color: color.mutedForeground },
  chat: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

function useComputerName() {
  const local = useLocalComputer();
  const box = useLocalBox();
  return { local, name: thisComputerName(local, box.status?.name) };
}

// This computer, in the one sidebar. Chats that belong to this machine sit
// under the row. A Mac still gets the row from its hostname when native
// sessions are not available; it does not invent chats.
export function ThisComputerRow() {
  const { local, name } = useComputerName();
  const client = useStore((s) => s.client);
  const view = useStore((s) => s.view);
  const sessions = useLocalThreadList((s) => s.sessions);
  const conversations = useLocalThreadList((s) => s.conversations);
  const [collapsed, setCollapsed] = useState(false);
  const active = view.kind === "local" && !view.session && !view.history;

  useEffect(() => {
    if (!client || !local?.supported) return;
    const stamp = Date.now();
    const controller = new AbortController();
    void (async () => {
      try {
        const status = await localApi.status(client, controller.signal);
        const history = await localApi.conversations(client, controller.signal);
        if (!controller.signal.aborted) publishLocalThreads(status.sessions, history, stamp);
      } catch {
        // Opening This computer reports the failure. The row stays.
      }
    })();
    return () => controller.abort();
  }, [client, local?.supported]);

  if (!name) return null;
  const chats = local?.supported ? { sessions: [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)), conversations: [...conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) } : { sessions: [], conversations: [] };
  const count = chats.sessions.length + chats.conversations.length;
  return (
    <div>
      <Tip label={`This computer: ${name}`} side="right">
        <button
          type="button"
          data-testid="nav-local"
          aria-label={`This computer: ${name}`}
          aria-current={active ? "page" : undefined}
          aria-expanded={count > 0 ? !collapsed : undefined}
          onClick={() => useStore.getState().setView({ kind: "local" })}
          {...stylex.props(styles.local, styles.wide, active && styles.on)}
        >
          {count > 0 && (
            <ChevronRightIcon
              aria-hidden
              {...stylex.props(styles.fold, !collapsed && styles.folded)}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((v) => !v);
              }}
            />
          )}
          <MonitorIcon {...stylex.props(styles.icon)} />
          <span {...stylex.props(styles.text)}>
            <span {...stylex.props(styles.name)}>{name}</span>
            <span {...stylex.props(styles.sub)}>This computer</span>
          </span>
        </button>
      </Tip>
      {count > 0 && !collapsed && (
        <SidebarMenuSub indent="repo">
          {chats.sessions.map((s) => <SessionChat key={s.id} session={s} />)}
          {chats.conversations.map((c) => <HistoryChat key={c.id} conversation={c} />)}
        </SidebarMenuSub>
      )}
    </div>
  );
}

function SessionChat({ session }: { session: LocalSession }) {
  const active = useStore((s) => s.view.kind === "local" && s.view.session?.id === session.id);
  const label = `${localAgentName(session.agent)} ${session.cwd} ${session.state}`;
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton render={<button type="button" aria-label={label} />} size="sm" density="row" isActive={active} onClick={() => useStore.getState().setView({ kind: "local", session })}>
        <MessageSquareIcon {...stylex.props(styles.icon)} />
        <span {...stylex.props(styles.chat)}>{localAgentName(session.agent)}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function HistoryChat({ conversation }: { conversation: LocalConversation }) {
  const active = useStore((s) => s.view.kind === "local" && s.view.history?.id === conversation.id);
  const title = conversation.title || "Untitled conversation";
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton render={<button type="button" aria-label={title} />} size="sm" density="row" isActive={active} onClick={() => useStore.getState().setView({ kind: "local", history: conversation })}>
        <MessageSquareIcon {...stylex.props(styles.icon)} />
        <span {...stylex.props(styles.chat)}>{title}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

export function ThisComputerRail() {
  const { name } = useComputerName();
  const active = useStore((s) => s.view.kind === "local");
  if (!name) return null;
  return (
    <Tip label={`This computer: ${name}`} side="right">
      <button
        type="button"
        data-testid="nav-local"
        aria-label={`This computer: ${name}`}
        aria-current={active ? "page" : undefined}
        onClick={() => useStore.getState().setView({ kind: "local" })}
        {...stylex.props(styles.local, styles.compact, active && styles.on)}
      >
        <MonitorIcon {...stylex.props(styles.icon)} />
      </button>
    </Tip>
  );
}
