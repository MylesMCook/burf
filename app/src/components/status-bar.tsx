import { CircleArrowUpIcon, GitBranchIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { StatusDot } from "@/components/agent-glyph";
import { BoxMeter } from "@/components/box-processes";
import { QueueIndicator } from "@/components/queue/queue-indicator";
import { Tip } from "@/components/tip";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateAll } from "@/components/upgrade-box";
import { useAgentCounts, useAllSessions } from "@/hooks/use-agent-counts";
import { isMock } from "@/hooks/use-burf-connection";
import { viaRoute } from "@/lib/box-routes";
import { useOutdatedBoxes } from "@/lib/outdated";
import { AGENT_WORDS, BOX_WORDS, boxState } from "@/lib/state-model";
import { useStore } from "@/lib/store";
import { restartToUpdate, useAgentRestart, useUpdater } from "@/lib/updater";
import { cn } from "@/lib/utils";
import { PluginBoundary, pluginContexts } from "@/plugins/plugin-boundary";
import { useRegistry } from "@/plugins/registry";
import { openRenameWorktree } from "@/components/sidebar/rename-worktree";
import { leaves } from "@/lib/layout";
import { attentionTarget } from "@/lib/session-decision";
import { focusSession, goHome, homeBox, useWorkspaces } from "@/lib/workspaces";
import { findWorktree } from "@/lib/worktree-names";

// StatusBar is the strip along the bottom: what agents are doing on the
// left, the boxes on the right. Every item goes somewhere when clicked.
export function StatusBar() {
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const connection = useStore((s) => s.connection);
  // The agent restarting after an update (lib/updater.ts) is away a moment.
  const restarting = useAgentRestart((s) => s.restarting);
  const counts = useAgentCounts();
  const sessions = useAllSessions();
  const items = useRegistry((s) => s.statusBarItems);
  const [syncing, setSyncing] = useState(false);
  const go = useStore((s) => s.setView);

  const outdated = useOutdatedBoxes();
  const screenBox = useWorkspaces((s) => {
    const key = s.current;
    if (!key || homeBox(key)) return undefined;
    return s.spaces[key]?.ref.box;
  });
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const named = inWorkspace ? screenBox : undefined;
  const online = [...(status?.boxes.filter((b) => b.state === "online") ?? [])].sort((a, b) => Number(b.name === named) - Number(a.name === named));
  const total = status?.boxes.length ?? 0;
  // Online, over a slow link: still online, said quietly.
  const slow = online.filter((b) => b.link?.slow).length;
  const forwards = status?.forwards.length ?? 0;
  // A count opens that agent: the one in the worktree in front, or the one
  // that has been in this state longest. A second click moves to the next.
  const openAgents = (state: "waiting" | "running") => {
    const view = useStore.getState().view.kind;
    const wsState = useWorkspaces.getState();
    const ws = view === "workspace" && wsState.current ? wsState.spaces[wsState.current] : undefined;
    const ref = ws && !homeBox(wsState.current) ? ws.ref : undefined;
    const tab = ws?.tabs.find((t) => t.id === ws.active);
    const leaf = tab ? (leaves(tab.root).find((l) => l.id === tab.focus) ?? leaves(tab.root)[0]) : undefined;
    const focused = leaf?.content.kind === "terminal" ? { box: leaf.content.box, name: leaf.content.session } : undefined;
    const target = attentionTarget(
      sessions.filter((e) => e.state === state).map((e) => ({ box: e.box, name: e.session.name, dir: e.session.dir, since: e.session.state_since })),
      ref ? { box: ref.box, dir: ref.path } : undefined,
      focused,
    );
    if (target) void focusSession(target.box, target.name);
    else goHome();
  };

  return (
    <footer className="@container flex h-6.5 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-t bg-sidebar px-3 text-[11px] text-muted-foreground">
      {/* ?shots=1, used by site/scripts/capture.mjs, hides the badge. */}
      {__BERTH_DEMO__ ? (
        !new URLSearchParams(location.search).has("shots") && <Tip label="A demo: invented boxes and repositories, and nothing runs">
          <span className="rounded border border-border px-1">demo</span>
        </Tip>
      ) : isMock() && !new URLSearchParams(location.search).has("shots") && (
        <Tip label="Showing made-up data (?mock=1)">
          <span className="rounded border border-warning/40 px-1 text-warning-foreground">mock</span>
        </Tip>
      )}
      {connection.state === "offline" && restarting ? (
        <span className="flex items-center gap-1.5">
          <Spinner className="size-3" />
          Restarting the Burf agent…
        </span>
      ) : connection.state === "offline" ? (
        <Tip label={connection.error}>
          <span className="flex items-center gap-1.5 text-destructive">
            <span className="size-1.5 rounded-full bg-destructive" />
            Agent unreachable
          </span>
        </Tip>
      ) : (
        <>
          {counts.waiting > 0 && (
            <Item className="text-warning-foreground dark:text-warning" onClick={() => openAgents("waiting")} tip="Open the agent that needs you">
              <span className="size-1.5 rounded-full bg-warning" />
              {counts.waiting} {AGENT_WORDS["needs-you"].lower}
            </Item>
          )}
          <Item onClick={() => openAgents("running")} tip="Open a working agent">
            {counts.running} {AGENT_WORDS.working.lower}
          </Item>
        </>
      )}
      <WorktreeItem />
      <QueueIndicator />
      {items
        .filter((i) => i.item.align !== "right")
        .map(({ plugin, item }) => (
          <PluginBoundary key={`${plugin}:${item.id}`} plugin={plugin} inline>
            <item.Component berth={pluginContexts.get(plugin)!} />
          </PluginBoundary>
        ))}

      <div className="flex-1" />

      {items
        .filter((i) => i.item.align === "right")
        .map(({ plugin, item }) => (
          <PluginBoundary key={`${plugin}:${item.id}`} plugin={plugin} inline>
            <item.Component berth={pluginContexts.get(plugin)!} />
          </PluginBoundary>
        ))}
      <UpdateItem />
      <OutdatedItem />
      {online.map((b) => {
        const mem = boxes[b.name]?.stats?.memory;
        const here = b.name === named;
        if (!mem?.total) return here ? <span key={b.name}>{b.name}</span> : null;
        // The computer on screen stays named when the bar runs short of room.
        // The others follow it. Clicked, a meter lists that box's browsers
        // and heavy sessions; its tip names the route Burf reaches it by.
        return <BoxMeter key={b.name} box={b.name} mem={mem} route={viaRoute(b)} className={here ? undefined : "@max-[1100px]:hidden"} />;
      })}
      {forwards > 0 && (
        <Item tip="Ports forwarded to this computer" onClick={() => go({ kind: "settings", section: "developer" })}>
          {forwards} {forwards === 1 ? "forward" : "forwards"}
        </Item>
      )}
      <Item
        tip={status?.boxes.map((b) => {
          const st = boxState(b, boxes[b.name], outdated.includes(b.name));
          return (
            <span key={b.name} className="flex items-center gap-1.5">
              <StatusDot state={st} />
              {b.name}: {BOX_WORDS[st].lower}
              {b.state === "online" && viaRoute(b) && <span className="text-muted-foreground">· {viaRoute(b)}</span>}
            </span>
          );
        })}
        onClick={() => go({ kind: "settings", section: "boxes" })}
      >
        {/* Green when every box is up (fainter while one's link is slow), grey when some aren't: amber is only ever "needs you". */}
        <StatusDot state={online.length === total && total > 0 ? (slow > 0 ? "slow" : "online") : "offline"} />
        {online.length}/{total} {total === 1 ? "box" : "boxes"} online
        {slow > 0 && <span data-testid="boxes-slow">· {slow === 1 && total > 1 ? `${online.find((b) => b.link?.slow)?.name} slow` : "slow"}</span>}
      </Item>
      <Tip label="Refresh" align="end">
        <button
          type="button"
          aria-label="Refresh"
          className="hover:text-foreground"
          onClick={async () => {
            setSyncing(true);
            await useStore.getState().refreshAll();
            setSyncing(false);
          }}
        >
          <RefreshCwIcon className={cn("size-3", syncing && "animate-spin")} />
        </button>
      </Tip>
    </footer>
  );
}

// WorktreeItem names the worktree in front, by its display name when it
// has one, and renames it when clicked.
function WorktreeItem() {
  const at = useWorkspaces((s) => (s.current && !homeBox(s.current) ? s.spaces[s.current]?.ref : undefined));
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const boxes = useStore((s) => s.boxes);
  const found = at?.path ? findWorktree(at.box, at.path, boxes) : undefined;
  if (!inWorkspace || !at || !found) return null;
  const { loc, wt } = found;
  const title = wt.title?.trim();
  const own = [wt.name, wt.branch && wt.branch !== wt.name ? `branch ${wt.branch}` : undefined].filter(Boolean).join(" · ");
  if (wt.main) return null;
  return (
    <Item
      data-testid="status-worktree"
      className="min-w-0 @max-[700px]:hidden"
      tip={
        <span className="flex flex-col">
          {title ? `${title} · ${own}` : own}
          <span className="text-muted-foreground">Click to rename it (F2 in the sidebar)</span>
        </span>
      }
      onClick={() => openRenameWorktree(at.box, loc, wt, { inPlace: false })}
    >
      <GitBranchIcon className="size-3 shrink-0" />
      <span className="max-w-56 truncate">{title || wt.name}</span>
    </Item>
  );
}

// UpdateItem shows once a newer Burf is downloaded, and restarts into it
// when clicked. Checking and downloading stay out of sight.
function UpdateItem() {
  const update = useUpdater();
  if (update.status !== "ready" && update.status !== "installing") return null;
  const installing = update.status === "installing";
  return (
    <Item
      className="text-foreground"
      disabled={installing}
      tip={`Burf ${update.version} is downloaded. Restarting reopens this window; agents keep running on their boxes.`}
      onClick={() => void restartToUpdate()}
    >
      <CircleArrowUpIcon className="size-3 text-success" />
      {installing ? "Updating…" : "Restart to update"}
    </Item>
  );
}

// OutdatedItem reports boxes whose agent differs from the bundled build, with
// Update all in one click and its progress while it runs. Settings → Boxes
// says the same, with each box's output.
function OutdatedItem() {
  const { outdated, busy, running, progress, updateAll } = useUpdateAll();
  if (!outdated.length && !busy) return null;
  if (busy) {
    return (
      <Item className="text-foreground" tip="Installing Burf's bundled box agent. Settings → Boxes shows each box's output." onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
        <Spinner className="size-3" />
        Updating {running ?? "boxes"}… {progress && <span className="text-muted-foreground tabular-nums">{progress}</span>}
      </Item>
    );
  }
  const n = outdated.length;
  return (
    <span className="flex items-center gap-1.5">
      <Item tip={`${outdated.join(", ")} ${n === 1 ? "has" : "have"} a different agent build from Burf's bundle, not necessarily an older one.`} onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
        <CircleArrowUpIcon className="size-3 text-info" />
        {n === 1 ? `${outdated[0]}: different build` : `${n} different builds`}
      </Item>
      <span aria-hidden className="text-muted-foreground/60">—</span>
      <Item className="font-medium text-foreground" tip="Replaces each box agent with the build bundled with Burf" onClick={updateAll}>
        Install bundled
      </Item>
    </span>
  );
}

// Item is one clickable entry, with what it means in a tooltip.
function Item({ className, tip, ...props }: React.ComponentProps<"button"> & { tip?: React.ReactNode }) {
  return (
    <Tip label={tip}>
      <button type="button" className={cn("flex items-center gap-1.5 rounded px-1 -mx-1 hover:bg-accent hover:text-foreground", className)} {...props} />
    </Tip>
  );
}
