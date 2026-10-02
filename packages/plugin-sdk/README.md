# @berth/plugin

Types for Berth plugins. A plugin is an ES module whose default export
receives a `BerthPluginContext`, registers what it adds, and may return a
cleanup function:

```tsx
import type { BerthPluginContext } from "@berth/plugin";
import { Button } from "@berth/plugin/ui";

export default function activate(berth: BerthPluginContext) {
  berth.addCommand({ id: "hello", title: "Say hello", run: () => berth.notify("Hello", "from a plugin") });
  berth.addScreen({ id: "hello", title: "Hello", Component: () => <Button>Hi</Button> });
  berth.addSidebarItem({ id: "hello", title: "Hello", icon: "Sparkles", screen: "hello" });
}
```

Bundle it as ESM with `react`, `react/jsx-runtime`, `react-dom`,
`@berth/plugin` and `@berth/plugin/ui` left external: the app provides one
shared copy of each, so plugin components are ordinary React components in
the app's tree. Put the bundle and a `berth-plugin.json` in
`~/.berth/plugins/<id>/`:

```json
{ "id": "hello", "name": "Hello", "version": "0.1.0", "main": "dist/index.js" }
```

See `plugins/hello-ports` in the Berth repository for a complete example.
