import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactJSXRuntime from "react/jsx-runtime";

import type { Client, PluginInfo } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { builtinOn } from "@/lib/prefs";
import { makeContext } from "@/plugins/context";
import { pluginContexts } from "@/plugins/plugin-boundary";
import { removePlugin, setPluginOrder, setPluginStatus, usePluginsLoading } from "@/plugins/registry";
import * as sdk from "@/plugins/sdk-runtime";
import { pluginUi } from "@/plugins/ui";

// Plugins are ES modules that import react, react-dom and @berth/plugin by
// name. They must get the app's own copies: a second React would break
// hooks, and components from @berth/plugin/ui must be the app's. The app
// publishes them on globalThis.__berth, and the shims in public/shims/
// re-export from there.
//
// A plugin's source is fetched with the agent's token and imported from a
// blob: URL. Bare imports are rewritten to the shims' absolute URLs before
// that, so loading does not depend on the import map in index.html reaching
// blob: modules (it does in Chromium, and it is the fallback for plugins
// loaded any other way).

const SHIMS: Record<string, string> = {
  react: "react.js",
  "react/jsx-runtime": "react-jsx-runtime.js",
  "react/jsx-dev-runtime": "react-jsx-runtime.js",
  "react-dom": "react-dom.js",
  "@berth/plugin": "berth-plugin.js",
  "@berth/plugin/ui": "berth-plugin-ui.js",
};

export function installGlobals() {
  (globalThis as Record<string, unknown>).__berth = { React, ReactDOM, ReactJSXRuntime, sdk, ui: pluginUi };
}

// rewriteImports points every shared bare import at its shim. It handles
// `from "x"`, `import "x"` and `import("x")`, which is what bundlers emit.
export function rewriteImports(source: string, base = location.href): string {
  return source.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"']+)\2/g, (whole, lead: string, quote: string, spec: string) => {
    const shim = SHIMS[spec];
    return shim ? `${lead}${quote}${new URL(`${import.meta.env.BASE_URL}shims/${shim}`, base).href}${quote}` : whole;
  });
}

const loaded = new Map<string, { dispose?: () => void; url: string }>();

// Built-in plugins ship with the app in public/builtin-plugins/, listed in
// its index.json by `pnpm build:plugins`. A missing index means none.
export async function builtinPlugins(): Promise<PluginInfo[]> {
  try {
    // From the app's base: "/" in the app, the demo's own folder on the web.
    const res = await fetch(new URL(`${import.meta.env.BASE_URL}builtin-plugins/index.json`, location.href));
    if (!res.ok) return [];
    const list = (await res.json()) as PluginInfo[];
    return list.map((p) => ({ ...p, builtin: true, entry: `${import.meta.env.BASE_URL}builtin-plugins/${p.id}/${p.main}` }));
  } catch {
    return [];
  }
}

async function pluginSource(client: Client, p: PluginInfo): Promise<string> {
  if (!p.builtin) return client.pluginSource(p);
  const res = await fetch(new URL(p.entry!, location.href));
  if (!res.ok) throw new Error(`${p.id}: ${res.status}`);
  return res.text();
}

async function loadPlugin(client: Client, p: PluginInfo) {
  setPluginStatus({ id: p.id, name: p.name, version: p.version, state: "loading", builtin: p.builtin });
  try {
    if (p.error) throw new Error(p.error);
    const source = rewriteImports(await pluginSource(client, p));
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const mod = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    if (typeof mod.default !== "function") throw new Error("its module has no default export function");
    const ctx = makeContext(p.id, client);
    pluginContexts.set(p.id, ctx);
    const dispose = await (mod.default as (c: typeof ctx) => unknown)(ctx);
    loaded.set(p.id, { url, dispose: typeof dispose === "function" ? (dispose as () => void) : undefined });
    setPluginStatus({ id: p.id, name: p.name, version: p.version, state: "active", builtin: p.builtin });
  } catch (err) {
    removePlugin(p.id);
    setPluginStatus({ id: p.id, name: p.name, version: p.version, state: "failed", error: errorMessage(err), builtin: p.builtin });
    console.error(`plugin ${p.id} failed to load`, err);
  }
}

export function unloadPlugin(id: string) {
  const l = loaded.get(id);
  try {
    l?.dispose?.();
  } catch (err) {
    console.error(`plugin ${id}: cleanup failed`, err);
  }
  if (l) URL.revokeObjectURL(l.url);
  loaded.delete(id);
  pluginContexts.delete(id);
  removePlugin(id);
}

// loadPlugins (re)loads the built-in plugins that are on, and every enabled
// plugin the agent lists. A user plugin replaces a built-in with its id.
export async function loadPlugins(client: Client) {
  usePluginsLoading.setState(true, true);
  const [user, builtins] = await Promise.all([
    client.plugins().catch((err) => {
      console.warn("could not list plugins", err);
      return [] as PluginInfo[];
    }),
    builtinPlugins(),
  ]);
  for (const id of [...loaded.keys()]) unloadPlugin(id);
  const userIds = new Set(user.map((p) => p.id));
  const list = [...builtins.filter((b) => !userIds.has(b.id) && builtinOn(b)), ...user.filter((p) => p.enabled !== false)];
  setPluginOrder(list.map((p) => p.id));
  await Promise.all(list.map((p) => loadPlugin(client, p)));
  usePluginsLoading.setState(false, true);
}
