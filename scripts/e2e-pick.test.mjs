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
