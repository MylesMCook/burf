import { iconScale } from "@/components/ui/icon-tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { ChevronRightIcon, FolderIcon, MessageSquareIcon, MonitorIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Tip } from "@/components/tip";
import { Input } from "@/components/ui/input";
import { SidebarMenuButton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { localAgentName, localApi, publishLocalThreads, useLocalComputer, useLocalThreadList, type LocalConversation, type LocalSession } from "@/lib/local-computer";
import { useLocalBox } from "@/lib/local-box";
import { useStore } from "@/lib/store";
import { thisComputerName, thisComputerTarget } from "@/lib/this-computer";
import { folderName } from "@/lib/local-folders";
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
  row: { display: "flex", width: "100%", minWidth: 0, alignItems: "center", gap: 4, marginBottom: 4 },
  disclosure: { width: 28, height: 28, justifyContent: "center", flexShrink: 0 },
  focus: { outline: { ":focus-visible": "2px solid var(--sidebar-ring)" }, outlineOffset: 2 },
  history: { "--side-row": "44px" },
  group: { marginTop: 8 },
  heading: { display: "flex", alignItems: "center", gap: 6, minWidth: 0, paddingLeft: 8, paddingRight: 8, fontSize: 12, fontWeight: 500, color: color.mutedForeground },
  empty: { paddingLeft: 8, paddingRight: 8, fontSize: 12, color: color.mutedForeground },
  compact: { width: 32, height: 32, justifyContent: "center" },
  on: { backgroundColor: color.sidebarAccent, color: color.foreground },
  icon: { width: iconScale.action, height: iconScale.action, flexShrink: 0 },
  fold: { width: iconScale.disclosure, height: iconScale.disclosure, flexShrink: 0, color: color.mutedForeground },
  folded: { transform: "rotate(90deg)" },
  name: { flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: color.foreground },
  machineScope: { flexShrink: 0, whiteSpace: "nowrap", fontSize: 11, color: color.mutedForeground },
  sub: { display: "block", fontSize: 12, color: color.mutedForeground },
  search: { paddingLeft: 8, paddingRight: 8, paddingBottom: 4 },
  chat: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  summary: { display: "block", width: "100%", minWidth: 0, listStyle: "none", cursor: "pointer", borderRadius: radius.md, outline: { ":focus-visible": "2px solid var(--ring)" }, "::-webkit-details-marker": { display: "none" } },
  projectHeading: { display: "flex", width: "100%", minWidth: 0, height: 28, alignItems: "center", gap: 8, paddingLeft: 8, paddingRight: 8, borderRadius: radius.md, fontSize: 13, lineHeight: "20px", fontWeight: 500, color: color.foreground, backgroundColor: { default: "transparent", ":is(summary:hover > &)": color.sidebarAccent } },
  projectFold: { width: iconScale.disclosure, height: iconScale.disclosure, flexShrink: 0, color: color.mutedForeground, transform: { default: "rotate(0deg)", ":is(details[open] > summary &)": "rotate(90deg)" } },
  projectName: { flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  count: { flexShrink: 0, fontVariantNumeric: "tabular-nums", fontSize: 11 },
});

function useComputerName() {
  const local = useLocalComputer();
  const box = useLocalBox();
  return { local, box: box.status?.box, name: thisComputerName(local, box.status?.name) };
}

function openComputer(supported: boolean | undefined, box: string | undefined) {
  useStore.getState().setView(thisComputerTarget(supported, box));
}

// This computer, in the one sidebar. Chats that belong to this machine sit
// under the row. Older clients can still name it from their local box.
export function ThisComputerRow() {
  const { local, box, name } = useComputerName();
  const client = useStore((s) => s.client);
  const view = useStore((s) => s.view);
  const sessions = useLocalThreadList((s) => s.sessions);
  const conversations = useLocalThreadList((s) => s.conversations);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const historyId = useId();
  const active = view.kind === "local" && !view.session && !view.history || view.kind === "worktrees" && !!box && view.box === box;

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
  const matches = (text: string) => text.toLowerCase().includes(search.trim().toLowerCase());
  const matchingSessions = chats.sessions.filter((s) => matches(`${localAgentName(s.agent)} ${s.cwd} ${s.state}`));
  const projects = new Map<string, LocalConversation[]>();
  for (const conversation of chats.conversations) {
    if (!matches(`${conversation.title} ${conversation.cwd} ${localAgentName(conversation.source)} ${conversation.updated_at}`)) continue;
    const group = projects.get(conversation.cwd) ?? [];
    group.push(conversation);
    projects.set(conversation.cwd, group);
  }
  return (
    <section aria-label={`This computer: ${name}`}>
      <div {...stylex.props(styles.row)}>
      <Tip label={`This computer: ${name}`} side="right">
        <SidebarMenuButton
          size="sm"
          density="row"
          isActive={active}
          data-testid="nav-local"
          aria-label={`This computer: ${name}`}
          aria-current={active ? "page" : undefined}
          onClick={() => openComputer(local?.supported, box)}
          onKeyDown={(e) => {
            if (count && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
              e.preventDefault();
              setCollapsed(e.key === "ArrowLeft");
            }
          }}
        >
          <MonitorIcon {...stylex.props(styles.icon)} />
          <span {...stylex.props(styles.name)}>{name}</span>
          <span {...stylex.props(styles.machineScope)}>This computer</span>
        </SidebarMenuButton>
      </Tip>
      {count > 0 && <Tip label={collapsed ? "Show local conversations" : "Hide local conversations"} side="right">
        <button type="button" aria-label={collapsed ? "Show local conversations" : "Hide local conversations"} aria-expanded={!collapsed} aria-controls={historyId} onClick={() => setCollapsed((value) => !value)} {...stylex.props(styles.local, styles.disclosure, styles.focus)}>
          <ChevronRightIcon aria-hidden {...stylex.props(styles.fold, !collapsed && styles.folded)} />
        </button>
      </Tip>}
      </div>
      {count > 0 && (
        <div id={historyId} hidden={collapsed} {...stylex.props(styles.history)}>
        <div {...stylex.props(styles.search)}><Input size="sm" aria-label="Search local conversations" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {!!matchingSessions.length && <section {...stylex.props(styles.group)} aria-label="Started in Burf">
          <h3 {...stylex.props(styles.heading)}>Started in Burf</h3>
          <SidebarMenuSub indent="repo">{matchingSessions.map((session) => <SessionChat key={session.id} session={session} />)}</SidebarMenuSub>
        </section>}
        {!!projects.size && <section {...stylex.props(styles.group)} aria-label="Existing conversations">
          <h3 {...stylex.props(styles.heading)}>Existing conversations</h3>
          {[...projects].map(([cwd, conversations]) => <section key={cwd} aria-label={cwd || "Unknown project"} {...stylex.props(styles.group)}>
            <details open>
              <summary aria-label={`Conversations in ${cwd || "Unknown project"}`} {...stylex.props(styles.summary)}>
                <h4 {...stylex.props(styles.projectHeading)}><ChevronRightIcon aria-hidden {...stylex.props(styles.projectFold)} /><FolderIcon aria-hidden {...stylex.props(styles.icon)} /><Tip label={cwd || "Unknown project"} width="lg"><span {...stylex.props(styles.projectName)}>{cwd ? folderName(cwd) : "Unknown project"}</span></Tip><span {...stylex.props(styles.count)}>{conversations.length}</span></h4>
              </summary>
              <SidebarMenuSub indent="repo">{conversations.map((conversation) => <HistoryChat key={conversation.id} conversation={conversation} />)}</SidebarMenuSub>
            </details>
          </section>)}
        </section>}
        {!matchingSessions.length && !projects.size && <p role="status" {...stylex.props(styles.empty)}>No matching conversations.</p>}
        </div>
      )}
    </section>
  );
}

function SessionChat({ session }: { session: LocalSession }) {
  const active = useStore((s) => s.view.kind === "local" && s.view.session?.id === session.id);
  const label = `${localAgentName(session.agent)} ${session.cwd} ${session.state}`;
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton render={<button type="button" aria-label={label} />} size="sm" density="row" isActive={active} onClick={() => useStore.getState().setView({ kind: "local", session })}>
        <MessageSquareIcon {...stylex.props(styles.icon)} />
        <span {...stylex.props(styles.chat)}>{localAgentName(session.agent)} · {session.cwd.split(/[\\/]/).filter(Boolean).at(-1)}<span {...stylex.props(styles.sub)}>{session.state}</span></span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function HistoryChat({ conversation }: { conversation: LocalConversation }) {
  const metadataId = useId();
  const active = useStore((s) => s.view.kind === "local" && s.view.history?.id === conversation.id);
  const title = conversation.title || "Untitled conversation";
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton render={<button type="button" aria-label={title} aria-describedby={metadataId} />} size="sm" density="row" isActive={active} onClick={() => useStore.getState().setView({ kind: "local", history: conversation })}>
        <MessageSquareIcon {...stylex.props(styles.icon)} />
        <span {...stylex.props(styles.chat)}>{title}<span id={metadataId} {...stylex.props(styles.sub)}>{localAgentName(conversation.source)} · <time dateTime={conversation.updated_at}>{new Date(conversation.updated_at).toLocaleDateString()}</time></span></span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

export function ThisComputerRail() {
  const { local, box, name } = useComputerName();
  const active = useStore((s) => s.view.kind === "local" || s.view.kind === "worktrees" && !!box && s.view.box === box);
  if (!name) return null;
  return (
    <Tip label={`This computer: ${name}`} side="right">
      <button
        type="button"
        data-testid="nav-local"
        aria-label={`This computer: ${name}`}
        aria-current={active ? "page" : undefined}
        onClick={() => openComputer(local?.supported, box)}
        {...stylex.props(styles.local, styles.compact, active && styles.on)}
      >
        <MonitorIcon {...stylex.props(styles.icon)} />
      </button>
    </Tip>
  );
}
