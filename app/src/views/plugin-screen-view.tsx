import { PluginBoundary, pluginContexts } from "@/plugins/plugin-boundary";
import { useRegistry } from "@/plugins/registry";

export function PluginScreenView({ screen }: { screen: string }) {
  const entry = useRegistry((s) => s.screens.find((c) => c.item.id === screen));
  if (!entry) return <p className="p-6 text-muted-foreground text-sm">The plugin that adds this screen is not loaded.</p>;
  const { plugin, item } = entry;
  return (
    <PluginBoundary plugin={plugin}>
      <div className="h-full overflow-y-auto">
        <item.Component berth={pluginContexts.get(plugin)!} />
      </div>
    </PluginBoundary>
  );
}
