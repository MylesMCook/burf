import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { useAgentCounts } from "@/hooks/use-agent-counts";
import { isMock } from "@/hooks/use-berth-connection";
import { bytes } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PluginBoundary, pluginContexts } from "@/plugins/plugin-boundary";
import { useRegistry } from "@/plugins/registry";

// StatusBar is the strip along the bottom: what agents are doing on the
// left, the boxes on the right. Every item goes somewhere when clicked.
export function StatusBar() {
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const connection = useStore((s) => s.connection);
  const counts = useAgentCounts();
  const items = useRegistry((s) => s.statusBarItems);
  const [syncing, setSyncing] = useState(false);
  const go = useStore((s) => s.setView);

  const online = status?.boxes.filter((b) => b.state === "online") ?? [];
  const total = status?.boxes.length ?? 0;
  const forwards = status?.forwards.length ?? 0;

  return (
    <footer className="flex h-6.5 shrink-0 items-center gap-3 border-t bg-sidebar px-3 text-[11px] text-muted-foreground">
      {isMock() && (
        <span className="rounded border border-warning/40 px-1 text-warning/80" title="Showing made-up data (?mock=1)">
          mock
        </span>
      )}
      {connection.state === "offline" ? (
        <span className="flex items-center gap-1.5 text-destructive" title={connection.error}>
          <span className="size-1.5 rounded-full bg-destructive" />
          Agent unreachable
        </span>
      ) : (
        <>
          {counts.waiting > 0 && (
            <Item className="text-warning-foreground dark:text-warning" onClick={() => go({ kind: "dashboard" })} title="Agents waiting for you">
              <span className="size-1.5 rounded-full bg-warning" />
              {counts.waiting} waiting
            </Item>
          )}
          <Item onClick={() => go({ kind: "dashboard" })} title="Open the agent dashboard">
            {counts.running} working
          </Item>
        </>
      )}
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
      {online.map((b) => {
        const mem = boxes[b.name]?.stats?.memory;
        if (!mem?.total) return null;
        const used = mem.used / mem.total;
        return (
          <Item key={b.name} className={cn(used > 0.85 && "text-warning-foreground dark:text-warning")} title={`${b.name} memory: ${bytes(mem.used)} of ${bytes(mem.total)} in use`} onClick={() => go({ kind: "settings", section: "boxes" })}>
            {b.name}
            <span className="relative h-1.5 w-6 overflow-hidden rounded-full bg-muted-foreground/20">
              <span className={cn("absolute inset-y-0 left-0 rounded-full", used > 0.85 ? "bg-warning" : "bg-muted-foreground/60")} style={{ width: `${Math.round(used * 100)}%` }} />
            </span>
            <span className="tabular-nums">{Math.round(used * 100)}%</span>
          </Item>
        );
      })}
      {forwards > 0 && (
        <Item title="Ports forwarded to this computer" onClick={() => go({ kind: "settings", section: "developer" })}>
          {forwards} {forwards === 1 ? "forward" : "forwards"}
        </Item>
      )}
      <Item title={status?.boxes.map((b) => `${b.name}: ${b.state}`).join("\n")} onClick={() => go({ kind: "settings", section: "boxes" })}>
        <span className={cn("size-1.5 rounded-full", online.length === total && total > 0 ? "bg-success" : online.length ? "bg-warning" : "bg-muted-foreground/40")} />
        {online.length}/{total} {total === 1 ? "box" : "boxes"}
      </Item>
      <button
        type="button"
        aria-label="Refresh"
        title="Refresh"
        className="hover:text-foreground"
        onClick={async () => {
          setSyncing(true);
          await useStore.getState().refreshAll();
          setSyncing(false);
        }}
      >
        <RefreshCwIcon className={cn("size-3", syncing && "animate-spin")} />
      </button>
    </footer>
  );
}

function Item({ className, ...props }: React.ComponentProps<"button">) {
  return <button type="button" className={cn("flex items-center gap-1.5 rounded px-1 -mx-1 hover:bg-accent hover:text-foreground", className)} {...props} />;
}
