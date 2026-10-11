import assert from "node:assert/strict";
import test from "node:test";

import { SMOKE, specsFor } from "./e2e-pick.mjs";

const all = () => true;

test("inventory data, views and acceptance scenarios reach the inventory spec", () => {
  assert.deepEqual(specsFor(["app/src/lib/inventory.ts", "app/src/components/inventory/machine-inventory.tsx", "app/src/views/machine-view.tsx", "app/src/views/settings/inspect-ssh.tsx", "app/e2e/inventory.feature"], all), ["inventory"]);
});

test("a spec that changed runs itself, and only itself", () => {
  assert.deepEqual(specsFor(["app/e2e/custom-font.spec.ts"], all), ["custom-font"]);
});

test("a change to the chat runs the chat's specs", () => {
  assert.deepEqual(specsFor(["app/src/components/chat/chat.tsx"], all), ["chat-experience", "chat-features", "local-chat", "remote-chat"]);
});

test("a path nothing knows runs the smoke set, never everything", () => {
  assert.deepEqual(specsFor(["app/src/lib/something-new.ts"], all), [...SMOKE].sort());
  assert.deepEqual(specsFor(["app/e2e/fixtures.ts"], all), [...SMOKE].sort());
});

test("nothing in the page changed: no browser spec", () => {
  assert.deepEqual(specsFor(["internal/wire/server.go", "README.md", "app/src/lib/format.test.ts"], all), []);
});

test("a spec that no longer exists is not asked for", () => {
  assert.deepEqual(specsFor(["app/src/views/home/home-view.tsx"], (s) => s !== "home-terminal"), ["home-composer", "home-widgets", "monitor"]);
});

test("launcher deletions reach the composer and workspace specs", () => {
  assert.deepEqual(specsFor(["app/src/components/workspace/launcher.tsx"], all), ["home-composer", "keyboard", "remote-chat", "workspace"]);
});

test("terminal pane changes reach restoration, terminal and surviving chat specs", () => {
  assert.deepEqual(specsFor(["app/src/components/workspace/pane.tsx"], all), ["chat-experience", "keyboard", "local-computer", "predict", "remote-chat", "workspace"]);
});

test("native Go and generated binding paths do not pull in unrelated browser smoke", () => {
  assert.deepEqual(specsFor(["app/native/desktop/service.go", "app/bindings/desktop/service.ts"], all), []);
});

test("shared overlay changes run geometry assertions as well as smoke", () => {
  assert.ok(specsFor(["app/src/components/ui/sheet.tsx"], all).includes("overlay-layout"));
});

test("plugin and Home source changes reach their saved acceptance cases", () => {
  assert.deepEqual(specsFor(["plugins/box-monitor/src/index.tsx"], all), ["monitor", "plugin-workflow-actions"]);
  assert.deepEqual(specsFor(["app/src/plugins/host.ts", "plugins/issues/src/index.tsx"], all), ["feedback-refinement", "plugin-workflow-actions", "plugins"]);
  assert.deepEqual(specsFor(["app/src/views/home/widgets/machine-filter.tsx"], all), ["home-widgets", "monitor"]);
});

test("native feedback controls and stock task composer reach their browser outcomes", () => {
  assert.ok(specsFor(["app/src/views/settings/general-section.tsx"], all).includes("custom-font"));
  assert.ok(specsFor(["app/src/views/settings/terminal-section.tsx"], all).includes("custom-font"));
  assert.deepEqual(specsFor(["app/src/native-feedback/state.ts"], all), ["native-feedback-settings"]);
  assert.ok(specsFor(["app/src/components/assistant-ui/elements/composer.tsx"], all).includes("home-composer"));
  assert.ok(specsFor(["app/src/components/ui/button.tsx"], all).includes("feedback-refinement"));
});
