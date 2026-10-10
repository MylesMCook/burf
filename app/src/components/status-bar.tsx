import { CircleArrowUpIcon, GitBranchIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { StatusDot } from "@/components/agent-glyph";
import { BoxMeter } from "@/components/box-processes";
import { QueueIndicator } from "@/components/queue/queue-indicator";
import { Tip } from "@/components/tip";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateAll } from "@/components/upgrade-box";
import { useAgentCounts } from "@/hooks/use-agent-counts";
import { isMock } from "@/hooks/use-burf-connection";
import { viaRoute } from "@/lib/box-routes";
import { useOutdatedBoxes } from "@/lib/outdated";
import { AGENT_WORDS, BOX_WORDS, boxState } from "@/lib/state-model";
import { useStore } from "@/lib/store";
import { restartToUpdate, useAgentRestart, useUpdater } from "@/lib/updater";
import { PluginBoundary, pluginContexts } from "@/plugins/plugin-boundary";
import { useRegistry } from "@/plugins/registry";
import { openRenameWorktree } from "@/components/sidebar/rename-worktree";
import { homeBox, useWorkspaces } from "@/lib/workspaces";
import { findWorktree } from "@/lib/worktree-names";
import { color, radius } from "@/styles/tokens.stylex";

const tight = "@container (max-width: 700px)";
const crowded = "@container (max-width: 1100px)";
const still = "@media (prefers-reduced-motion: reduce)";

const spin = stylex.keyframes({
  to: { transform: "rotate(360deg)" },
});

const styles = stylex.create({
  bar: {
    containerType: "inline-size",
    display: "flex",
    height: 26,
    flexShrink: 0,
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    whiteSpace: "nowrap",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    backgroundColor: color.sidebar,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 11,
    color: color.mutedForeground,
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    paddingLeft: 4,
    paddingRight: 4,
  },
  mock: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "color-mix(in oklab, var(--warning) 40%, transparent)",
    paddingLeft: 4,
    paddingRight: 4,
    color: "var(--warning-foreground)",
  },
  cluster: { display: "flex", alignItems: "center", gap: 6 },
  down: { display: "flex", alignItems: "center", gap: 6, color: color.destructive },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: color.destructive },
  waitDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: color.warning },
  spacer: { flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  hideMeter: { display: { default: "contents", [crowded]: "none" } },
  refresh: {
    color: { default: color.mutedForeground, ":hover": color.foreground },
  },
  icon: { width: 12, height: 12, flexShrink: 0 },
  successIcon: { width: 12, height: 12, flexShrink: 0, color: color.success },
  infoIcon: { width: 12, height: 12, flexShrink: 0, color: color.info },
  spinning: {
    animationName: spin,
    animationDuration: { default: "1s", [still]: "0s" },
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  tip: { display: "flex", flexDirection: "column" },
  quiet: { color: color.mutedForeground },
  name: { maxWidth: 224, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  nums: { color: color.mutedForeground, fontVariantNumeric: "tabular-nums" },
  dim: { color: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)" },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm,
    paddingLeft: 4,
    paddingRight: 4,
    marginLeft: -4,
    marginRight: -4,
    backgroundColor: { default: "transparent", ":hover": color.accent },
    color: { default: "inherit", ":hover": color.foreground },
  },
  warning: { color: { default: "var(--warning-foreground)", ":hover": color.foreground } },
  foreground: { color: { default: color.foreground, ":hover": color.foreground } },
  medium: { fontWeight: 500 },
  hideNarrow: {
    minWidth: 0,
    display: { default: "flex", [tight]: "none" },
  },
});

// StatusBar is the strip along the bottom: what agents are doing on the
// left, the boxes on the right. Every item goes somewhere when clicked.
export function StatusBar() {
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const connection = useStore((s) => s.connection);
  // The agent restarting after an update (lib/updater.ts) is away a moment.
  const restarting = useAgentRestart((s) => s.restarting);
  const counts = useAgentCounts();
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

  return (
    <footer {...stylex.props(styles.bar)}>
      {/* ?shots=1, used by site/scripts/capture.mjs, hides the badge. */}
      {__BERTH_DEMO__ ? (
        !new URLSearchParams(location.search).has("shots") && <Tip label="A demo: invented boxes and repositories, and nothing runs">
          <span {...stylex.props(styles.chip)}>demo</span>
        </Tip>
      ) : isMock() && !new URLSearchParams(location.search).has("shots") && (
        <Tip label="Showing made-up data (?mock=1)">
          <span {...stylex.props(styles.mock)}>mock</span>
        </Tip>
      )}
      {connection.state === "offline" && restarting ? (
        <span {...stylex.props(styles.cluster)}>
          <Spinner size="sm" />
          Restarting the Burf agent…
        </span>
      ) : connection.state === "offline" ? (
        <Tip label={connection.error}>
          <span {...stylex.props(styles.down)}>
            <span {...stylex.props(styles.dot)} />
            Agent unreachable
          </span>
        </Tip>
      ) : (
        <>
          {counts.waiting > 0 && (
            <Item tone="warning" onClick={() => go({ kind: "dashboard" })} tip="Agents waiting for your answer or permission">
              <span {...stylex.props(styles.waitDot)} />
              {counts.waiting} {AGENT_WORDS["needs-you"].lower}
            </Item>
          )}
          <Item onClick={() => go({ kind: "dashboard" })} tip="Open the agent dashboard">
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

      <div {...stylex.props(styles.spacer)} />

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
        const meter = <BoxMeter key={b.name} box={b.name} mem={mem} route={viaRoute(b)} />;
        return here ? meter : <span key={b.name} {...stylex.props(styles.hideMeter)}>{meter}</span>;
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
            <span key={b.name} {...stylex.props(styles.cluster)}>
              <StatusDot state={st} />
              {b.name}: {BOX_WORDS[st].lower}
              {b.state === "online" && viaRoute(b) && <span {...stylex.props(styles.quiet)}>· {viaRoute(b)}</span>}
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
          {...stylex.props(styles.refresh)}
          onClick={async () => {
            setSyncing(true);
            await useStore.getState().refreshAll();
            setSyncing(false);
          }}
        >
          <RefreshCwIcon {...stylex.props(styles.icon, syncing && styles.spinning)} />
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
      hide="narrow"
      tip={
        <span {...stylex.props(styles.tip)}>
          {title ? `${title} · ${own}` : own}
          <span {...stylex.props(styles.quiet)}>Click to rename it (F2 in the sidebar)</span>
        </span>
      }
      onClick={() => openRenameWorktree(at.box, loc, wt, { inPlace: false })}
    >
      <GitBranchIcon {...stylex.props(styles.icon)} />
      <span {...stylex.props(styles.name)}>{title || wt.name}</span>
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
      tone="foreground"
      disabled={installing}
      tip={`Burf ${update.version} is downloaded. Restarting reopens this window; agents keep running on their boxes.`}
      onClick={() => void restartToUpdate()}
    >
      <CircleArrowUpIcon {...stylex.props(styles.successIcon)} />
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
      <Item tone="foreground" tip="Installing Burf's bundled box agent. Settings → Boxes shows each box's output." onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
        <Spinner size="sm" />
        Updating {running ?? "boxes"}… {progress && <span {...stylex.props(styles.nums)}>{progress}</span>}
      </Item>
    );
  }
  const n = outdated.length;
  return (
    <span {...stylex.props(styles.cluster)}>
      <Item tip={`${outdated.join(", ")} ${n === 1 ? "has" : "have"} a different agent build from Burf's bundle, not necessarily an older one.`} onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
        <CircleArrowUpIcon {...stylex.props(styles.infoIcon)} />
        {n === 1 ? `${outdated[0]}: different build` : `${n} different builds`}
      </Item>
      <span aria-hidden {...stylex.props(styles.dim)}>—</span>
      <Item tone="foreground" weight="medium" tip="Replaces each box agent with the build bundled with Burf" onClick={updateAll}>
        Install bundled
      </Item>
    </span>
  );
}

// Item is one clickable entry, with what it means in a tooltip.
function Item({
  tip,
  tone,
  weight,
  hide,
  ...props
}: Omit<React.ComponentProps<"button">, "className" | "style"> & {
  tip?: React.ReactNode;
  tone?: "warning" | "foreground";
  weight?: "medium";
  hide?: "narrow";
}) {
  return (
    <Tip label={tip}>
      <button type="button" {...stylex.props(styles.item, tone === "warning" && styles.warning, tone === "foreground" && styles.foreground, weight === "medium" && styles.medium, hide === "narrow" && styles.hideNarrow)} {...props} />
    </Tip>
  );
}
