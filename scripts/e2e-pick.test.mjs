import assert from "node:assert/strict";
import test from "node:test";

import { SMOKE, specsFor } from "./e2e-pick.mjs";

const all = () => true;

test("a spec that changed runs itself, and only itself", () => {
  assert.deepEqual(specsFor(["app/e2e/custom-font.spec.ts"], all), ["custom-font"]);
});

test("a change to the chat runs the chat's specs", () => {
  assert.deepEqual(specsFor(["app/src/components/chat/chat.tsx"], all), ["chat-experience", "local-chat", "remote-chat"]);
});

test("a path nothing knows runs the smoke set, never everything", () => {
  assert.deepEqual(specsFor(["app/src/lib/something-new.ts"], all), [...SMOKE].sort());
  assert.deepEqual(specsFor(["app/e2e/fixtures.ts"], all), [...SMOKE].sort());
});

test("nothing in the page changed: no browser spec", () => {
  assert.deepEqual(specsFor(["internal/wire/server.go", "README.md", "app/src/lib/format.test.ts"], all), []);
});

test("a spec that no longer exists is not asked for", () => {
  assert.deepEqual(specsFor(["app/src/views/home/home-view.tsx"], (s) => s !== "home-terminal"), ["home-composer", "home-widgets"]);
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
