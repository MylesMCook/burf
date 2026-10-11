import { CircleArrowUpIcon, GitBranchIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { StatusDot } from "@/components/agent-glyph";
import { BoxMeter } from "@/components/box-processes";
import { QueueIndicator } from "@/components/queue/queue-indicator";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { statusBarMemory } from "@/lib/status-bar-memory";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateAll } from "@/components/upgrade-box";
import { useAgentCounts } from "@/hooks/use-agent-counts";
import { fleetBytes, fleetStats } from "@/views/home/widgets/fleet-stats";
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
  fleet: { flexShrink: 0 },
  machines: { margin: 0, padding: 0, listStyleType: "none", display: "flex", flexDirection: "column", gap: 16 },
  machine: { display: "flex", flexDirection: "column", gap: 8 },
  machineHead: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  machineName: { fontWeight: 500, overflowWrap: "anywhere", minWidth: 0 },
  detail: { fontSize: 12, color: color.mutedForeground, overflowWrap: "anywhere" },
  choice: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 },
  memory: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 },
  readings: { display: "grid", gridTemplateColumns: { default: "repeat(2, minmax(0, 1fr))", "@media (max-width: 639px)": "minmax(0, 1fr)" }, gap: 8, margin: 0, fontSize: 12 },
  reading: { minWidth: 0, overflowWrap: "anywhere" },
  readingName: { color: color.mutedForeground },
  readingValue: { margin: 0, fontVariantNumeric: "tabular-nums" },
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
  const monitor = useRegistry((s) => s.screens.find((screen) => screen.plugin === "box-monitor" && screen.item.id === "boxes"));
  const [syncing, setSyncing] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  const hiddenMeters = usePrefs((p) => p.statusBarHiddenBoxes);
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
    <footer aria-label="Status bar" data-testid="status-bar" {...stylex.props(styles.bar)}>
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
      <Dialog open={fleetOpen} onOpenChange={setFleetOpen}>
        <Tip label="All computers and status bar options">
          <DialogTrigger render={<button type="button" data-testid="status-fleet" {...stylex.props(styles.item, styles.fleet)} />}>
            <StatusDot state={online.length === total && total > 0 ? (slow > 0 ? "slow" : "online") : "offline"} />
            {online.length}/{total} {total === 1 ? "computer" : "computers"} online
            {slow > 0 && <span data-testid="boxes-slow">· {slow === 1 && total > 1 ? online.find((b) => b.link?.slow)?.name + " slow" : "slow"}</span>}
          </DialogTrigger>
        </Tip>
        <DialogPopup width="md">
          <DialogHeader>
            <DialogTitle>Computers and status bar</DialogTitle>
            <DialogDescription>Current readings and known Burf sessions on paired computers. Choose which memory meters appear in this window's status bar.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {connection.state !== "online" && <p {...stylex.props(styles.detail)}>Agent unreachable. Memory readings are unavailable until it reconnects.</p>}
            <ul {...stylex.props(styles.machines)}>
              {status?.boxes.map((b) => {
                const st = boxState(b, boxes[b.name], outdated.includes(b.name));
                const data = boxes[b.name];
                const available = connection.state === "online" && b.state === "online" && !data?.error;
                const mem = statusBarMemory(data?.stats?.memory, available);
                const readings = fleetStats(available ? data?.stats : undefined);
                const sessions = available ? data?.sessions : undefined;
                const unavailable = b.state !== "online" ? "Unavailable: computer offline" : data?.error ? "Unavailable: refresh failed" : connection.state !== "online" ? "Unavailable: agent unreachable" : "Unavailable: no reading";
                const memoryLabel = boxes[b.name]?.info?.os === "darwin" ? "RAM used (excludes cache)" : "Memory";
                return (
                  <li key={b.name} data-testid="status-machine" data-box={b.name} {...stylex.props(styles.machine)}>
                    <div {...stylex.props(styles.machineHead)}>
                      <span {...stylex.props(styles.machineName)}>{b.name}</span>
                      <StatusDot state={st} /><span {...stylex.props(styles.detail)}>{BOX_WORDS[st].word}</span>
                      <Button variant="ghost" size="sm" aria-label={"Open projects on " + b.name} onClick={() => { setFleetOpen(false); go({ kind: "worktrees", box: b.name }); }}>Open projects</Button>
                    </div>
                    {b.state === "online" && viaRoute(b) && <p {...stylex.props(styles.detail)}>{viaRoute(b)}</p>}
                    <div {...stylex.props(styles.memory)}>
                      <span>{memoryLabel}</span>
                      {mem ? <><BoxMeter box={b.name} mem={mem} route={viaRoute(b)} memoryLabel={memoryLabel} onNavigate={() => setFleetOpen(false)} /><span {...stylex.props(styles.detail)}>{mem.used === 0 ? "0 B" : `${(mem.used / 2 ** 30).toFixed(1)} GiB`} of {(mem.total / 2 ** 30).toFixed(1)} GiB in use</span></> : <span {...stylex.props(styles.detail)}>{unavailable}</span>}
                    </div>
                    <dl {...stylex.props(styles.readings)}>
                      <div {...stylex.props(styles.reading)}><dt {...stylex.props(styles.readingName)}>Load average (1m)</dt><dd {...stylex.props(styles.readingValue)}>{readings.load === undefined ? unavailable : `${readings.load.toFixed(2)}${readings.cpus === undefined ? "" : ` on ${readings.cpus} CPUs`}`}</dd></div>
                      <div {...stylex.props(styles.reading)}><dt {...stylex.props(styles.readingName)}>Fullest disk{readings.diskMount ? ` · ${readings.diskMount}` : ""}</dt><dd {...stylex.props(styles.readingValue)}>{readings.disk === undefined ? unavailable : `${Math.round(readings.disk * 100)}% used · ${fleetBytes(readings.diskUsed!)} of ${fleetBytes(readings.diskTotal!)}`}</dd></div>
                      <div {...stylex.props(styles.reading)}><dt {...stylex.props(styles.readingName)}>Known Burf sessions</dt><dd {...stylex.props(styles.readingValue)}>{sessions === undefined ? unavailable : `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}</dd></div>
                    </dl>
                    <label {...stylex.props(styles.choice)}>
                      <Checkbox checked={!hiddenMeters.includes(b.name)} onCheckedChange={(checked) => {
                        const hidden = new Set(usePrefs.getState().statusBarHiddenBoxes);
                        if (checked) hidden.delete(b.name); else hidden.add(b.name);
                        setPrefs({ statusBarHiddenBoxes: [...hidden] });
                      }} />
                      Show {b.name} memory in status bar
                    </label>
                  </li>
                );
              })}
            </ul>
            {!total && <p {...stylex.props(styles.detail)}>No paired computers. Add one in computer settings.</p>}
            <p {...stylex.props(styles.detail)}>Load is work waiting or running, not CPU utilization. Session counts describe Burf sessions, not detected processes.</p>
          </DialogPanel>
          <DialogFooter>
            {monitor && <Button variant="outline" onClick={() => { setFleetOpen(false); go({ kind: "plugin", screen: monitor.item.id }); }}>Open machine readings</Button>}
            <Button variant="outline" onClick={() => { setFleetOpen(false); go({ kind: "settings", section: "boxes" }); }}>Computer settings</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      {online.filter((b) => !hiddenMeters.includes(b.name)).map((b) => {
        const mem = statusBarMemory(boxes[b.name]?.stats?.memory, connection.state === "online" && !boxes[b.name]?.error);
        const here = b.name === named;
        if (!mem) return <span key={b.name} {...stylex.props(!here && styles.hideMeter)}><Item tip="Open all computer readings" onClick={() => setFleetOpen(true)}>{b.name} · Memory unavailable</Item></span>;
        // The computer on screen stays named when the bar runs short of room.
        // The others follow it. Clicked, a meter lists that box's browsers
        // and heavy sessions; its tip names the route Burf reaches it by.
        const memoryLabel = boxes[b.name]?.info?.os === "darwin" ? "RAM used (excludes cache)" : "Memory";
        const meter = <span key={b.name} {...stylex.props(styles.cluster)}><Tip label={memoryLabel}><span>{memoryLabel === "Memory" ? "Memory" : "RAM"}</span></Tip> <BoxMeter box={b.name} mem={mem} route={viaRoute(b)} memoryLabel={memoryLabel} /></span>;
        return here ? meter : <span key={b.name} {...stylex.props(styles.hideMeter)}>{meter}</span>;
      })}
      {forwards > 0 && (
        <Item tip="Ports forwarded to this computer" onClick={() => go({ kind: "settings", section: "developer" })}>
          {forwards} {forwards === 1 ? "forward" : "forwards"}
        </Item>
      )}
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
