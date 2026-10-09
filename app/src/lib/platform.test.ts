import assert from "node:assert/strict";
import test from "node:test";
import { primaryModifier, shortcutLabel } from "./platform.ts";

test("Windows shortcuts use Ctrl and reject mixed Windows/Control modifiers", () => {
  assert.equal(primaryModifier({ ctrlKey: true, metaKey: false }, false), true);
  assert.equal(primaryModifier({ ctrlKey: false, metaKey: true }, false), false);
  assert.equal(primaryModifier({ ctrlKey: true, metaKey: true }, false), false);
  assert.equal(primaryModifier({ ctrlKey: false, metaKey: true }, true), true);
  assert.equal(shortcutLabel("⌘⇧N", false), "Ctrl+Shift+N");
  assert.equal(shortcutLabel("⌘⌥D", false), "Ctrl+Alt+D");
  assert.equal(shortcutLabel("⌘⇧N", true), "⌘⇧N");
});
