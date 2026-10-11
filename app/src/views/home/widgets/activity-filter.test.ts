import assert from "node:assert/strict";
import test from "node:test";
import { activityFilter, ALL_ACTIVITY, matchesActivity, projectKey } from "./activity-filter.ts";

const now = Date.parse("2026-10-10T12:00:00Z");
const row = { state: "running", provider: "codex", project: projectKey("mini", "shop"), since: "2026-10-10T11:30:00Z" };
test("activity facets intersect and preserve the computer in a project identity", () => {
  assert.equal(matchesActivity(row, { window: "hour", state: "running", provider: "codex", project: row.project }, now), true);
  for (const filter of [{ ...ALL_ACTIVITY, state: "waiting" as const }, { ...ALL_ACTIVITY, provider: "claude" }, { ...ALL_ACTIVITY, project: projectKey("other", "shop") }]) assert.equal(matchesActivity(row, filter, now), false);
  assert.equal(matchesActivity({ ...row, project: undefined }, { ...ALL_ACTIVITY, project: "unassigned" }, now), true);
});
test("state-change windows preserve boundary times and exclude unknown or future times", () => {
  const filter = { ...ALL_ACTIVITY, window: "hour" as const };
  for (const since of ["2026-10-10T11:00:00Z", "2026-10-10T12:00:00Z"]) assert.equal(matchesActivity({ ...row, since }, filter, now), true);
  for (const since of [undefined, "invalid", "2026-10-10T10:59:59Z", "2026-10-10T12:00:01Z"]) assert.equal(matchesActivity({ ...row, since }, filter, now), false);
  assert.equal(matchesActivity({ ...row, since: undefined }, ALL_ACTIVITY, now), true);
});
test("unread projects are distinct from a confirmed unassigned task", () => {
  const unread = { ...row, project: undefined, projectKnown: false };
  assert.equal(matchesActivity(unread, ALL_ACTIVITY, now), true);
  assert.equal(matchesActivity(unread, { ...ALL_ACTIVITY, project: "unassigned" }, now), false);
  assert.equal(matchesActivity({ ...unread, projectKnown: true }, { ...ALL_ACTIVITY, project: "unassigned" }, now), true);
});
test("saved filters reject invalid finite choices and reset to the unfiltered default", () => {
  for (const value of [null, [], { state: "missing", window: "month", provider: 3, project: false }]) assert.deepEqual(activityFilter(value), ALL_ACTIVITY);
  assert.deepEqual(activityFilter({ state: "finished", window: "week", provider: "codex", project: row.project }), { state: "finished", window: "week", provider: "codex", project: row.project });
});
