// Checks that the release build's Content Security Policy lets the app load
// its plugins. Tauri applies the CSP only to the bundled app, never to
// `pnpm tauri dev`, so a directive that blocks plugins breaks only releases:
// v0.3.1 shipped without 'self' in connect-src, so the app could not fetch
// its own builtin-plugins/index.json and a fresh install had no built-ins.
//
//   node scripts/check-csp.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const conf = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const csp = Object.fromEntries(
  conf.app.security.csp
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .filter((d) => d[0])
    .map(([name, ...sources]) => [name, sources]),
);
const has = (directive, source, why) => assert.ok((csp[directive] ?? csp["default-src"] ?? []).includes(source), `${directive} needs ${source}: ${why}`);

// host.ts fetches the built-ins' index and modules from the app's own files.
has("connect-src", "'self'", "the app fetches its built-in plugins");
// User plugins come from the agent.
has("connect-src", "http://127.0.0.1:1378", "the app lists and fetches your plugins from the agent");
// Every plugin is imported from a blob: URL; its imports, the shims and lazy
// chunks (Diff's viewer and worker) come from the app's own files.
has("script-src", "blob:", "plugins are imported from blob: URLs");
has("script-src", "'self'", "plugins import the shims and their lazy chunks");
console.log("check-csp: ok");
