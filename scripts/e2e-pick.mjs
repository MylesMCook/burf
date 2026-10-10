#!/usr/bin/env node
// e2e-pick names the browser spec files a change should run before a push,
// from the paths it touches (one per line on stdin), the way ci-changes.mjs
// picks suites. A spec that changed runs itself. A source path runs the
// specs written for its part of the app. A path nothing here knows runs the
// smoke set: a handful of fast files, never the whole suite. Names of specs
// that no longer exist are dropped, so deleting a spec needs no edit here.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const E2E = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "e2e");

// The app starts, a task can be written, a chat opens, a saved conversation reads.
export const SMOKE = ["first-run", "home-composer", "remote-chat", "local-computer"];

// First match wins per path: put the narrower prefix first.
export const RULES = [
  { paths: ["app/src/components/chat/", "app/src/views/local-chat", "app/src/views/remote-chat", "app/src/lib/remote-chat", "app/src/lib/chat-", "app/src/components/assistant-ui/"], specs: ["remote-chat", "local-chat", "chat-experience", "chat-features"] },
  { paths: ["app/src/views/local-computer", "app/src/views/local-terminal", "app/src/lib/local-"], specs: ["local-computer", "local-chat"] },
  { paths: ["app/src/components/conversation/task-composer", "app/src/components/conversation/composer-", "app/src/lib/start-work", "app/src/lib/composer"], specs: ["home-composer", "composer", "agent-picker", "drop"] },
  { paths: ["app/src/views/home/"], specs: ["home-composer", "home-widgets", "home-terminal"] },
  { paths: ["app/src/lib/custom-font", "app/src/views/settings/custom-font", "app/src/views/settings/appearance"], specs: ["custom-font", "look"] },
  { paths: ["app/src/views/settings/"], specs: ["boxes-settings", "box-agents", "box-routes", "box-processes"] },
  { paths: ["app/src/views/onboarding/"], specs: ["first-run", "quick-install", "windows-client"] },
  { paths: ["app/src/components/sidebar/", "app/src/components/app-sidebar"], specs: ["sidebar-names", "sidebar-nesting", "sidebar-resize", "sidebar-fleet", "rail"] },
  { paths: ["app/src/components/files/", "app/src/components/diff/", "app/src/lib/git/"], specs: ["files", "files-panel"] },
  { paths: ["app/src/components/workspace/launcher", "app/src/components/workspace/new-tab-menu", "app/src/components/workspace/worktree-picker"], specs: ["remote-chat", "home-composer", "workspace", "keyboard"] },
  { paths: ["app/src/components/workspace/pane", "app/src/components/workspace/tab-strip", "app/src/components/workspace/zen", "app/src/lib/layout", "app/src/lib/workspaces", "app/src/lib/actions", "app/src/lib/compare", "app/src/components/conversation/"], specs: ["workspace", "keyboard", "predict", "remote-chat", "chat-experience", "local-computer"] },
  { paths: ["app/src/components/workspace/"], specs: ["workspace", "files-panel", "preview"] },
  { paths: ["app/src/components/notifications/", "app/src/lib/notification"], specs: ["notifications"] },
  { paths: ["app/src/components/art/", "app/src/components/charts/", "app/src/lib/art/"], specs: ["artifacts", "visual-diff"] },
  { paths: ["app/src/components/whats-new/"], specs: ["whats-new"] },
  { paths: ["app/src/components/command-palette", "app/src/lib/shortcuts", "app/src/hooks/use-shortcuts"], specs: ["keyboard", "predict"] },
  { paths: ["app/src/components/ui/", "app/src/index.css", "app/src/lib/themes/"], specs: ["look", "branding", "overlay-layout", ...SMOKE] },
];

const exists = (spec) => existsSync(join(E2E, `${spec}.spec.ts`));

// specsFor is the spec names the paths reach. Anything under app/ that no
// rule names (and the suite's own fixtures and config) reaches the smoke set.
export function specsFor(paths, has = exists) {
  const out = new Set();
  for (const path of paths) {
    const own = /^app\/e2e\/([\w.-]+)\.spec\.ts$/.exec(path);
    if (own) {
      out.add(own[1]);
      continue;
    }
    if (!path.startsWith("app/") || path.startsWith("app/native/") || path.startsWith("app/bindings/") || /\.test\.ts$/.test(path)) continue;
    const rule = RULES.find((r) => r.paths.some((p) => path.startsWith(p)));
    for (const spec of rule ? rule.specs : SMOKE) out.add(spec);
  }
  return [...out].filter(has).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = readFileSync(0, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const spec of specsFor(paths)) console.log(`${spec}.spec.ts`);
}
