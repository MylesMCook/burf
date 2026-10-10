import assert from "node:assert/strict";
import test from "node:test";

import { isSettingsPageQuery } from "./palette-query.ts";

const names = ["About", "Phone", "Developer"];

test("the command palette skips a new task when the query is a settings page", () => {
  assert.equal(isSettingsPageQuery("About", names), true);
  assert.equal(isSettingsPageQuery(" about ", names), true);
  assert.equal(isSettingsPageQuery("phone", names), true);
});

test("a partial name or a task still offers a new task", () => {
  assert.equal(isSettingsPageQuery("abo", names), false);
  assert.equal(isSettingsPageQuery("fix the login", names), false);
  assert.equal(isSettingsPageQuery("", names), false);
});
