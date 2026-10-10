import assert from "node:assert/strict";
import test from "node:test";

import { attentionCount, countNeedsYou, shownNoteTitle } from "./attention.ts";

const now = Date.parse("2026-10-10T00:00:00Z");

test("the badge counts unresolved needs-you, not every unread note", () => {
  const notes = [
    { needs: true, resolved: false, read: false },
    { needs: true, resolved: true, read: false },
    { needs: false, resolved: false, read: false },
    { needs: true, resolved: false, snoozedUntil: "2026-10-10T01:00:00Z" },
  ];
  assert.equal(countNeedsYou(notes, now), 1);
  assert.equal(attentionCount(countNeedsYou(notes, now), 0), 1);
});

test("the header and the badge add live waiting agents to the same count", () => {
  assert.equal(attentionCount(1, 2), 3);
  assert.equal(attentionCount(0, 0), 0);
});

test("a resolved needs-you row does not say needs you", () => {
  assert.equal(shownNoteTitle("Codex needs you", true), "Codex");
  assert.equal(shownNoteTitle("Codex needs you", false), "Codex needs you");
  assert.equal(shownNoteTitle("Claude Code is done", true), "Claude Code is done");
});
