import * as stylex from "@stylexjs/stylex";
import { PuzzleIcon } from "lucide-react";

import { useWorktreeRef } from "@/lib/workspaces";
import { PluginBoundary, pluginContexts } from "@/plugins/plugin-boundary";
import { useRegistry } from "@/plugins/registry";
import { Icon } from "@/plugins/ui";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s1: {
    "width": "16px",
    "height": "16px",
  },
  s2: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "auto",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// PanelIcon is the icon a plugin gave its panel, for tabs and pane headers.
export function PanelIcon({ plugin, panel, className }: { plugin: string; panel: string; className?: string }) {
  const icon = useRegistry((s) => s.worktreePanels.find((c) => c.plugin === plugin && c.item.id === panel)?.item.icon);
  return icon ? <Icon name={icon} className={className} /> : <PuzzleIcon className={className} />;
}

// PanelPane shows a plugin's worktree panel for the pane's worktree
// (paneWorktree: its own, else its tab's), given as wsKey. It waits quietly while plugins load, and says so when the
// plugin that added the panel is gone or turned off.
export function PanelPane({ wsKey, plugin, panel }: { wsKey: string; plugin: string; panel: string }) {
  const ref = useWorktreeRef(wsKey);
  const entry = useRegistry((s) => s.worktreePanels.find((c) => c.plugin === plugin && c.item.id === panel));
  const status = useRegistry((s) => s.plugins.find((p) => p.id === plugin));
  const ctx = pluginContexts.get(plugin);

  if (!entry || !ctx || !ref) {
    const text =
      !status || status.state === "loading"
        ? "Loading…"
        : status.state === "failed"
          ? `${status.name} failed to load: ${status.error ?? "unknown error"}`
          : entry && ctx
            ? "Its worktree is no longer on its box."
            : "This panel's plugin is turned off.";
    return (
      <div className={sx(paint.s0)}>
        <PuzzleIcon className={sx(paint.s1)} />
        {text}
      </div>
    );
  }
  const { Component } = entry.item;
  return (
    <div data-testid="panel" data-panel={`${plugin}/${panel}`} className={sx(paint.s2)}>
      <PluginBoundary plugin={plugin}>
        <Component berth={ctx} box={ref.box} location={ref.location} worktree={ref.worktree} path={ref.path} main={ref.main} />
      </PluginBoundary>
    </div>
  );
}
