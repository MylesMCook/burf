import assert from "node:assert/strict";
import test from "node:test";

import { inheritableSavedPermission } from "./local-computer-inherit.ts";

test("inheritedChatPermission skips full access", () => {
  assert.equal(inheritableSavedPermission("full-access"), undefined);
  assert.equal(inheritableSavedPermission("strict"), "strict");
  assert.equal(inheritableSavedPermission("read-only"), "read-only");
  assert.equal(inheritableSavedPermission("workspace"), "workspace");
  assert.equal(inheritableSavedPermission("not-a-mode"), undefined);
  assert.equal(inheritableSavedPermission(""), undefined);
});
